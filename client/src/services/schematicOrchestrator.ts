import { state, type SchematicState } from '../store/schematicState.ts';
import { componentLibrary } from './componentLibrary.ts';
import { GeometryService } from './geometryService.ts';
import { circuitManager } from './circuitManager.ts';
import { router } from './router.ts';
import { defaultLabelPlacementStrategy } from '../utils/labelPlacement.ts';
import type { ComponentInstance, ToolId, WorldPin, ComponentDefinition, WireSegment } from '../types/schematic.ts';

type StateListener = () => void;

class SchematicOrchestrator {
  private listeners = new Set<StateListener>();

  // --- State Management ---

  getState(): SchematicState {
    return state;
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Tool Management ---

  setActiveTool(toolId: ToolId) {
    state.activeToolId = toolId;
    state.selectedComponentIds.clear();
    state.selectedLabels.clear();
    state.pendingWire = null;
    this.notify();
  }

  // --- Component Operations ---

  async addComponent(id: string, url: string, x: number, y: number, rotation: number = 0) {
    try {
      const definition = await componentLibrary.fetchComponent(id, url);
      const instance: ComponentInstance = {
        id: crypto.randomUUID(),
        x,
        y,
        rotation,
        definition,
        refdes: '?',
        value: '?',
      };

      state.components.push(instance);

      // Add pins to spatial index
      definition.pins.forEach(pin => {
        const worldX = x + (pin.x * Math.cos(rotation * Math.PI / 180) - pin.y * Math.sin(rotation * Math.PI / 180));
        const worldY = y + (pin.x * Math.sin(rotation * Math.PI / 180) + pin.y * Math.cos(rotation * Math.PI / 180));
        state.spatialIndex.addPin({
          componentId: instance.id,
          pinNumber: pin.number,
          x: worldX,
          y: worldY
        });
      });

      // Sync with circuit manager
      const simTarget = definition.simulation?.[0];
      if (simTarget) {
        circuitManager.addComponent(
          instance.refdes,
          {
            engine: simTarget.engine,
            target: simTarget.target,
            pins: simTarget.pins
          },
          definition.pins.map(p => p.number),
          { value: instance.value }
        );
      }

      this.notify();
      return instance;
    } catch (error) {
      console.error(`Failed to add component ${id}:`, error);
      throw error;
    }
  }

  moveComponent(id: string, dx: number, dy: number) {
    const comp = state.components.find(c => c.id === id);
    if (!comp) return;

    comp.x = GeometryService.snap(comp.x + dx);
    comp.y = GeometryService.snap(comp.y + dy);

    this.updateSpatialIndex();
    this.updateWirePositions();
    this.notify();
  }

  moveSelected(dx: number, dy: number) {
    let anyMoved = false;
    state.components.forEach(comp => {
      if (state.selectedComponentIds.has(comp.id)) {
        const oldX = comp.x;
        const oldY = comp.y;
        comp.x = GeometryService.snap(comp.x + dx);
        comp.y = GeometryService.snap(comp.y + dy);
        if (oldX !== comp.x || oldY !== comp.y) {
          anyMoved = true;
        }
      }
    });
    if (anyMoved) {
      this.updateSpatialIndex();
      this.updateWirePositions();
      this.notify();
    }
    return anyMoved;
  }

  rotateComponent(id: string) {
    const comp = state.components.find(c => c.id === id);
    if (!comp) return;

    comp.rotation = (comp.rotation + 90) % 360;
    this.updateSpatialIndex();
    this.updateWirePositions();
    this.notify();
  }

  updateLabelOffset(compId: string, label: 'refdes' | 'value', dx: number, dy: number) {
    const comp = state.components.find(c => c.id === compId);
    if (!comp) return;

    if (label === 'refdes') {
      comp.refdesOffset = { x: (comp.refdesOffset?.x || 0) + dx, y: (comp.refdesOffset?.y || 0) + dy };
    } else {
      comp.valueOffset = { x: (comp.valueOffset?.x || 0) + dx, y: (comp.valueOffset?.y || 0) + dy };
    }
    this.notify();
  }

  rotateSelected() {
    let moved = false;
    state.components.forEach(comp => {
      if (state.selectedComponentIds.has(comp.id)) {
        const center = GeometryService.getComponentCenter(comp);
        const px = GeometryService.snap(center.x);
        const py = GeometryService.snap(center.y);

        // Rotate center around (px, py)
        const nextCenterX = px - (center.y - py);
        const nextCenterY = py + (center.x - px);

        const nextRotation = (comp.rotation + 90) % 360;
        const { width: nextW, height: nextH } = GeometryService.getCurrentDimensions({ ...comp, rotation: nextRotation });

        comp.x = nextCenterX - nextW / 2;
        comp.y = nextCenterY - nextH / 2;
        comp.rotation = nextRotation;

        if (comp.refdesOffset) {
          comp.refdesOffset = defaultLabelPlacementStrategy.rotateOffset(comp.refdesOffset);
        }
        if (comp.valueOffset) {
          comp.valueOffset = defaultLabelPlacementStrategy.rotateOffset(comp.valueOffset);
        }

        moved = true;
      }
    });
    if (moved) {
      this.updateSpatialIndex();
      this.updateWirePositions();
      this.notify();
    }
  }

  deleteComponent(id: string) {
    const index = state.components.findIndex(c => c.id === id);
    if (index === -1) return;

    const comp = state.components[index];
    state.components.splice(index, 1);

    this.updateSpatialIndex();
    circuitManager.removeComponent(comp.refdes);
    this.notify();
  }

  deleteSelected() {
    const deletedIds = new Set(state.selectedComponentIds);

    state.components.forEach(comp => {
      if (deletedIds.has(comp.id)) {
        circuitManager.removeComponent(comp.refdes);
      }
    });

    state.components = state.components.filter(comp => !deletedIds.has(comp.id));
    state.wires = state.wires.filter(wire => !deletedIds.has(wire.startPin.componentId) && !deletedIds.has(wire.endPin.componentId));
    state.selectedComponentIds.clear();
    this.updateSpatialIndex();
    this.notify();
  }

  private updateSpatialIndex() {
    state.spatialIndex.clear();
    state.components.forEach(c => {
      c.definition.pins.forEach(pin => {
        const pos = GeometryService.getPinWorldPos(c, pin);
        state.spatialIndex.addPin({
          componentId: c.id,
          pinNumber: pin.number,
          x: pos.x,
          y: pos.y
        });
      });
    });
  }

  // --- Wire Operations ---

  addWire(startPin: WorldPin, endPin: WorldPin) {
    this.createWire(startPin, endPin);
  }

  createWire(start: WorldPin, end: WorldPin, providedSegments?: WireSegment[]) {
    const startComp = state.components.find(c => c.id === start.componentId);
    const endComp = state.components.find(c => c.id === end.componentId);

    if (startComp && endComp) {
      circuitManager.connectComponentPins(
        startComp.refdes, start.pinNumber,
        endComp.refdes, end.pinNumber
      );
    }

    const segments = providedSegments || router.route(start, end, this.generateCostMap());
    const finalSegments = segments.length > 0 ? segments : [{ id: crypto.randomUUID(), x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
    state.wires.push({ id: crypto.randomUUID(), startPin: start, endPin: end, segments: finalSegments });
    this.notify();
  }

  generateCostMap(): Record<string, number> {
    const costMap: Record<string, number> = {};
    state.components.forEach(comp => {
      const { width, height } = GeometryService.getCurrentDimensions(comp);
      for (let x = comp.x; x <= comp.x + width; x += 10) {
        for (let y = comp.y; y <= comp.y + height; y += 10) {
          costMap[`${x},${y}`] = 100;
        }
      }
      comp.definition.pins.forEach(p => {
        const pos = GeometryService.getPinWorldPos(comp, p);
        costMap[`${pos.x},${pos.y}`] = 200;
      });
    });
    return costMap;
  }

  updateWirePositions() {
    state.wires.forEach(wire => {
      const startComp = state.components.find(c => c.id === wire.startPin.componentId);
      const endComp = state.components.find(c => c.id === wire.endPin.componentId);
      if (startComp && endComp) {
        const sP = startComp.definition.pins.find(p => p.number === wire.startPin.pinNumber)!;
        const eP = endComp.definition.pins.find(p => p.number === wire.endPin.pinNumber)!;

        const startPos = GeometryService.getPinWorldPos(startComp, sP);
        const endPos = GeometryService.getPinWorldPos(endComp, eP);

        wire.startPin.x = startPos.x; wire.startPin.y = startPos.y;
        wire.endPin.x = endPos.x; wire.endPin.y = endPos.y;
        if (wire.segments.length > 0) {
          wire.segments[0].x1 = wire.startPin.x; wire.segments[0].y1 = wire.startPin.y;
        }
        if (wire.segments.length > 1) {
          const last = wire.segments.length - 1;
          wire.segments[last].x2 = wire.endPin.x; wire.segments[last].y2 = wire.endPin.y;
        } else if (wire.segments.length === 1) {
          wire.segments[0].x1 = wire.startPin.x; wire.segments[0].y1 = wire.startPin.y;
          wire.segments[0].x2 = wire.endPin.x; wire.segments[0].y2 = wire.endPin.y;
        }
      }
    });
  }

  deleteWire(wireId: string) {
    const index = state.wires.findIndex(w => w.id === wireId);
    if (index === -1) return;

    const wire = state.wires[index];

    const comp1 = state.components.find(c => c.id === wire.startPin.componentId);
    const comp2 = state.components.find(c => c.id === wire.endPin.componentId);

    if (comp1 && comp2) {
      circuitManager.disconnectComponentPin(comp1.refdes, wire.startPin.pinNumber);
      circuitManager.disconnectComponentPin(comp2.refdes, wire.endPin.pinNumber);
    }

    state.wires.splice(index, 1);
    this.notify();
  }

  // --- Selection & Interaction ---

  setSelected(id: string | null, multi: boolean = false) {
    if (!multi) state.selectedComponentIds.clear();
    if (id) state.selectedComponentIds.add(id);
    this.notify();
  }

  toggleSelection(id: string) {
    state.selectedComponentIds.has(id) ? state.selectedComponentIds.delete(id) : state.selectedComponentIds.add(id);
    this.notify();
  }

  clearSelection() {
    state.selectedComponentIds.clear();
    state.selectedLabels.clear();
    this.notify();
  }

  setLabelSelected(compId: string, type: 'refdes' | 'value', multi: boolean = false) {
    if (!multi) state.selectedLabels.clear();
    state.selectedLabels.add(`${compId}:${type}`);
    this.notify();
  }

  toggleLabelSelection(compId: string, type: 'refdes' | 'value') {
    const key = `${compId}:${type}`;
    state.selectedLabels.has(key) ? state.selectedLabels.delete(key) : state.selectedLabels.add(key);
    this.notify();
  }

  selectComponents(ids: Set<string>) {
    state.selectedComponentIds = ids;
    this.notify();
  }

  updateMousePos(x: number, y: number) {
    state.mousePos = { x, y };
    // We don't notify on every mouse move to avoid performance issues, 
    // tools will handle their own redraws or a global requestAnimationFrame will be used.
  }

  getComponentDefinition(id: string): ComponentDefinition | undefined {
    const comp = state.components.find(c => c.id === id);
    return comp?.definition;
  }
}

export const orchestrator = new SchematicOrchestrator();