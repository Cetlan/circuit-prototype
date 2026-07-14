import { store } from '../store/schematicStore.ts';
import { GeometryService } from './geometryService.ts';
import { circuitManager } from './circuitManager.ts';
import { router } from './router.ts';
import { defaultLabelPlacementStrategy } from '../utils/labelPlacement.ts';
import { commandManager } from './commandManager.ts';
import type { ToolId, WorldPin, ComponentDefinition, WireSegment } from '../types/schematic.ts';

type StateListener = () => void;

class SchematicOrchestrator {
  private listeners = new Set<StateListener>();

  // --- State Management ---

  notify() {
    store.notify();
    this.listeners.forEach(l => l());
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    store.onLibraryUpdate(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Tool Management ---

  setActiveTool(toolId: ToolId) {
    store.setTool(toolId);
    store.selectedComponentIds.clear();
    store.selectedLabels.clear();
    store.pendingWire = null;
    this.notify();
  }

  // --- Component Operations ---

  async addComponent(id: string, url: string, x: number, y: number, rotation: number = 0) {
    const definition = await store.library.fetchComponent(id, url);
    return this.addComponentFromDefinition(definition, x, y, rotation);
  }

  async addComponentFromDefinition(definition: ComponentDefinition, x: number, y: number, rotation: number = 0) {
    const defaultValue = String(definition.properties?.value?.default ?? '?');

    // Use store.addComponent for consistency in refdes and simulation registration
    store.addComponent(x, y, definition, undefined, defaultValue);

    const instance = store.components[store.components.length - 1];
    instance.rotation = rotation;

    // If rotation is not 0, we need to update the spatial index because 
    // store.addComponent only does it for rotation 0.
    store.updateSpatialIndex();

    this.notify();
    return instance;
  }

  moveComponent(id: string, dx: number, dy: number) {
    const comp = store.components.find(c => c.id === id);
    if (!comp) return;

    comp.x = store.snap(comp.x + dx);
    comp.y = store.snap(comp.y + dy);

    store.updateSpatialIndex();
    store.updateWirePositions();
    this.notify();
  }

  moveSelected(dx: number, dy: number) {
    const anyMoved = store.moveSelected(dx, dy);
    if (anyMoved) {
      store.updateWirePositions();
      this.notify();
    }
    return anyMoved;
  }

  rotateComponent(id: string) {
    const comp = store.components.find(c => c.id === id);
    if (!comp) return;

    comp.rotation = (comp.rotation + 90) % 360;
    store.updateSpatialIndex();
    store.updateWirePositions();
    this.notify();
  }

  updateLabelOffset(compId: string, label: 'refdes' | 'value', dx: number, dy: number) {
    store.updateLabelOffset(compId, label, dx, dy);
    this.notify();
  }

  rotateSelected() {
    store.rotateSelected();
    store.updateWirePositions();
    this.notify();
  }

  deleteComponent(id: string) {
    const comp = store.components.find(c => c.id === id);
    if (!comp) return;

    store.selectedComponentIds.add(comp.id);
    store.deleteSelected();

    this.notify();
  }

  deleteSelected() {
    store.deleteSelected();
    this.notify();
  }

  private updateSpatialIndex() {
    store.updateSpatialIndex();
  }

  // --- Wire Operations ---

  addWire(startPin: WorldPin, endPin: WorldPin) {
    this.createWire(startPin, endPin);
  }

  createWire(start: WorldPin, end: WorldPin, providedSegments?: WireSegment[]) {
    store.createWire(start, end, providedSegments);
    this.notify();
  }

  updateWirePositions() {
    store.updateWirePositions();
  }

  deleteWire(wireId: string) {
    const wire = store.wires.find(w => w.id === wireId);
    if (!wire) return;

    const comp1 = store.components.find(c => c.id === wire.startPin.componentId);
    const comp2 = store.components.find(c => c.id === wire.endPin.componentId);

    if (comp1 && comp2) {
      circuitManager.disconnectComponentPin(comp1.refdes, wire.startPin.pinNumber);
      circuitManager.disconnectComponentPin(comp2.refdes, wire.endPin.pinNumber);
    }

    store.wires = store.wires.filter(w => w.id !== wireId);
    this.notify();
  }

  // --- Selection & Interaction ---

  setSelected(id: string | null, multi: boolean = false) {
    store.setSelected(id, multi);
    this.notify();
  }

  toggleSelection(id: string) {
    store.toggleSelection(id);
    this.notify();
  }

  clearSelection() {
    store.clearSelection();
    this.notify();
  }

  setLabelSelected(compId: string, type: 'refdes' | 'value', multi: boolean = false) {
    store.setLabelSelected(compId, type, multi);
    this.notify();
  }

  toggleLabelSelection(compId: string, type: 'refdes' | 'value') {
    store.toggleLabelSelection(compId, type);
    this.notify();
  }

  selectComponents(ids: Set<string>) {
    store.selectedComponentIds = ids;
    this.notify();
  }

  updateMousePos(x: number, y: number) {
    store.mousePos = { x, y };
    // We don't notify on every mouse move to avoid performance issues, 
    // tools will handle their own redraws or a global requestAnimationFrame will be used.
  }

  getComponentDefinition(id: string): ComponentDefinition | undefined {
    const comp = store.components.find(c => c.id === id);
    return comp?.definition;
  }
}

export const orchestrator = new SchematicOrchestrator();