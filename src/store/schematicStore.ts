import type { Pin, ComponentDefinition, ComponentInstance, WorldPin, Wire, ToolInterface } from '../types/schematic.ts';
import { SpatialIndex } from './spatialIndex.ts';
import { PlacementTool, SelectionTool, WiringTool } from './tools.ts';

class ComponentLibrary {
  private cache = new Map<string, ComponentDefinition>();

  async loadComponent(id: string, svgString: string): Promise<ComponentDefinition> {
    if (this.cache.has(id)) return this.cache.get(id)!;

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) throw new Error(`Invalid SVG for component ${id}`);

    const width = parseFloat(svgElement.getAttribute('width') || '0');
    const height = parseFloat(svgElement.getAttribute('height') || '0');
    const pinElements = svgDoc.querySelectorAll('[data-pin-number]');

    const pins: Pin[] = Array.from(pinElements).map(el => {
      const circle = el as SVGCircleElement;
      return {
        number: circle.getAttribute('data-pin-number') || '?',
        x: parseFloat(circle.getAttribute('cx') || '0'),
        y: parseFloat(circle.getAttribute('cy') || '0'),
      };
    }) as Pin[];

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const def: ComponentDefinition = { id, img, pins, width, height };
        this.cache.set(id, def);
        resolve(def);
      };
      img.onerror = reject;
      img.src = `data:image/svg+xml;base64,${btoa(svgString)}`;
    });
  }

  get(id: string) { return this.cache.get(id); }
}

class SchematicStore {
  public tools: Record<string, ToolInterface> = {
    selection: new SelectionTool(),
    wire: new WiringTool(),
    component: new PlacementTool(),
  };
  public activeTool: ToolInterface = this.tools.selection;
  public mousePos = { x: 0, y: 0 }; // Still needed for the 60fps render loop


  private gridSize = 10;
  public components: ComponentInstance[] = [];
  public selectedComponentIds = new Set<string>();
  public library = new ComponentLibrary();
  public spatialIndex = new SpatialIndex();

  public wires: Wire[] = [];
  public pendingWire: { startPin: WorldPin; currentPos: { x: number, y: number } } | null = null;

  private listeners: Array<() => void> = [];

  snap(value: number): number {
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  setTool(toolId: string) {
    this.activeTool = this.tools[toolId];
  }

  updateSpatialIndex() {
    this.spatialIndex.clear();
    this.components.forEach(comp => {
      comp.definition.pins.forEach(pin => {
        this.spatialIndex.addPin({
          componentId: comp.id,
          pinNumber: pin.number,
          x: comp.x + pin.x,
          y: comp.y + pin.y
        });
      });
    });
  }

  addComponent(x: number, y: number, def: ComponentDefinition) {
    this.components.push({ id: crypto.randomUUID(), x: this.snap(x), y: this.snap(y), definition: def });
    this.updateSpatialIndex();
  }

  moveSelected(dx: number, dy: number) {
    let moved = false;
    this.components.forEach(comp => {
      if (this.selectedComponentIds.has(comp.id)) {
        comp.x = this.snap(comp.x + dx);
        comp.y = this.snap(comp.y + dy);
        moved = true;
      }
    });
    if (moved) this.updateSpatialIndex();
  }

  // Add this to your deleteSelected logic
  deleteSelected() {
    // Delete components
    this.components = this.components.filter(comp => !this.selectedComponentIds.has(comp.id));

    // Delete wires that are connected to deleted components
    const deletedCompIds = new Set(this.selectedComponentIds);
    // Note: you'll need to capture the IDs before clearing the selection set
    this.wires = this.wires.filter(wire =>
      !deletedCompIds.has(wire.startPin.componentId) &&
      !deletedCompIds.has(wire.endPin.componentId)
    );

    this.selectedComponentIds.clear();
    this.updateSpatialIndex();
  }

  createWire(start: WorldPin, end: WorldPin) {
    const wireId = crypto.randomUUID();
    const wire: Wire = {
      id: wireId,
      startPin: start,
      endPin: end,
      segments: [{
        id: crypto.randomUUID(),
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y
      }]
    };
    this.wires.push(wire);
  }

  // Call this in the render loop or mouseMove to keep wires updated 
  // when components move (since pins are relative)
  updateWirePositions() {
    this.wires.forEach(wire => {
      // Recalculate the world position of the pins
      const startComp = this.components.find(c => c.id === wire.startPin.componentId);
      const endComp = this.components.find(c => c.id === wire.endPin.componentId);

      if (startComp && endComp) {
        const sPin = startComp.definition.pins.find(p => p.number === wire.startPin.pinNumber)!;
        const ePin = endComp.definition.pins.find(p => p.number === wire.endPin.pinNumber)!;

        wire.startPin.x = startComp.x + sPin.x;
        wire.startPin.y = startComp.y + sPin.y;
        wire.endPin.x = endComp.x + ePin.x;
        wire.endPin.y = endComp.y + ePin.y;

        // Update the first segment (Pass 1: simple line)
        if (wire.segments[0]) {
          wire.segments[0].x1 = wire.startPin.x;
          wire.segments[0].y1 = wire.startPin.y;
          wire.segments[0].x2 = wire.endPin.x;
          wire.segments[0].y2 = wire.endPin.y;
        }
      }
    });
  }

  setSelected(id: string | null, multi: boolean = false) {
    if (!multi) this.selectedComponentIds.clear();
    if (id) this.selectedComponentIds.add(id);
  }

  toggleSelection(id: string) {
    this.selectedComponentIds.has(id) ? this.selectedComponentIds.delete(id) : this.selectedComponentIds.add(id);
  }

  clearSelection() { this.selectedComponentIds.clear(); }

  onLibraryUpdate(cb: () => void) { this.listeners.push(cb); }
  notify() { this.listeners.forEach(cb => cb()); }
}

export const store = new SchematicStore();