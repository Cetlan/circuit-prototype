import type { ToolId, Pin, ComponentDefinition, ComponentInstance, WorldPin, Wire, WireSegment, ToolInterface } from '../types/schematic.ts';
import { SpatialIndex } from './spatialIndex.ts';
import { router } from '../services/router.ts';
import { PlacementTool, SelectionTool, WiringTool } from './tools.ts';

class ComponentLibrary {
  private cache = new Map<string, ComponentDefinition>();
  async loadComponent(id: string, svgString: string, colorOverrides?: Record<string, string>): Promise<ComponentDefinition> {
    if (this.cache.has(id)) return this.cache.get(id)!;

    const DEFAULT_COLOR = '#333333';
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) throw new Error(`Invalid SVG for component ${id}`);

    // Override colors
    const allElements = svgDoc.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = ['fill', 'stroke'];
      attrs.forEach(attr => {
        const val = el.getAttribute(attr);
        if (val && val !== 'none') {
          if (colorOverrides && colorOverrides[val]) {
            el.setAttribute(attr, colorOverrides[val]);
          } else if (!colorOverrides) {
            // If no specific overrides map is provided, apply default charcoal to everything
            el.setAttribute(attr, DEFAULT_COLOR);
          }
        }
      });
    });

    const serializer = new XMLSerializer();
    const modifiedSvgString = serializer.serializeToString(svgDoc);

    let width = parseFloat(svgElement.getAttribute('width') || '0');
    let height = parseFloat(svgElement.getAttribute('height') || '0');

    if (width === 0 || height === 0) {
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/\s+/).filter(Boolean).map(parseFloat);
        if (parts.length === 4) {
          if (width === 0) width = parts[2];
          if (height === 0) height = parts[3];
        }
      }
    }
    const pinElements = svgDoc.querySelectorAll('[data-pin-number]');
    const pins: Pin[] = Array.from(pinElements).map(el => {
      const circle = el as SVGCircleElement;
      return { number: circle.getAttribute('data-pin-number') || '?', x: parseFloat(circle.getAttribute('cx') || '0'), y: parseFloat(circle.getAttribute('cy') || '0') };
    }) as Pin[];

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const def: ComponentDefinition = { id, img, pins, width, height };
        this.cache.set(id, def);
        resolve(def);
      };
      img.onerror = reject;
      img.src = `data:image/svg+xml;base64,${btoa(modifiedSvgString)}`;
    });
  }
  get(id: string) { return this.cache.get(id); }
}

class SchematicStore {
  // 1. Declare types without assigning values immediately
  public tools!: Record<ToolId, ToolInterface>;
  public activeTool!: ToolInterface;

  private gridSize = 10;
  public components: ComponentInstance[] = [];
  public selectedComponentIds = new Set<string>();
  public wires: Wire[] = [];
  public pendingWire: { startPin: WorldPin, viaPoints: { x: number, y: number }[], currentPos: { x: number, y: number } } | null = null;
  public library = new ComponentLibrary();
  public spatialIndex = new SpatialIndex();
  public mousePos = { x: 0, y: 0 };
  private listeners: Array<() => void> = [];

  // 2. The Initialization Method to break circular dependency
  init() {
    this.tools = {
      selection: new SelectionTool(),
      component: new PlacementTool(),
      wire: new WiringTool(),
    };
    this.activeTool = this.tools.selection;
  }

  snap(value: number): number { return Math.round(value / this.gridSize) * this.gridSize; }
  setTool(toolId: ToolId) {
    this.activeTool = this.tools[toolId];
    this.notify();
  }

  updateSpatialIndex() {
    this.spatialIndex.clear();
    this.components.forEach(comp => {
      comp.definition.pins.forEach(pin => {
        this.spatialIndex.addPin({ componentId: comp.id, pinNumber: pin.number, x: comp.x + pin.x, y: comp.y + pin.y });
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

  deleteSelected() {
    const deletedIds = new Set(this.selectedComponentIds);
    this.components = this.components.filter(comp => !deletedIds.has(comp.id));
    this.wires = this.wires.filter(wire => !deletedIds.has(wire.startPin.componentId) && !deletedIds.has(wire.endPin.componentId));
    this.selectedComponentIds.clear();
    this.updateSpatialIndex();
  }

  setSelected(id: string | null, multi: boolean = false) {
    if (!multi) this.selectedComponentIds.clear();
    if (id) this.selectedComponentIds.add(id);
  }

  toggleSelection(id: string) {
    this.selectedComponentIds.has(id) ? this.selectedComponentIds.delete(id) : this.selectedComponentIds.add(id);
  }

  clearSelection() { this.selectedComponentIds.clear(); }

  createWire(start: WorldPin, end: WorldPin, providedSegments?: WireSegment[]) {
    const segments = providedSegments || router.route(start, end, this.generateCostMap());
    const finalSegments = segments.length > 0 ? segments : [{ id: crypto.randomUUID(), x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
    this.wires.push({ id: crypto.randomUUID(), startPin: start, endPin: end, segments: finalSegments });
  }

  generateCostMap(): Record<string, number> {
    const costMap: Record<string, number> = {};
    this.components.forEach(comp => {
      for (let x = comp.x; x <= comp.x + comp.definition.width; x += 10) {
        for (let y = comp.y; y <= comp.y + comp.definition.height; y += 10) {
          costMap[`${x},${y}`] = 100;
        }
      }
      comp.definition.pins.forEach(p => {
        costMap[`${comp.x + p.x},${comp.y + p.y}`] = 200;
      });
    });
    return costMap;
  }

  updateWirePositions() {
    this.wires.forEach(wire => {
      const startComp = this.components.find(c => c.id === wire.startPin.componentId);
      const endComp = this.components.find(c => c.id === wire.endPin.componentId);
      if (startComp && endComp) {
        const sP = startComp.definition.pins.find(p => p.number === wire.startPin.pinNumber)!;
        const eP = endComp.definition.pins.find(p => p.number === wire.endPin.pinNumber)!;
        wire.startPin.x = startComp.x + sP.x; wire.startPin.y = startComp.y + sP.y;
        wire.endPin.x = endComp.x + eP.x; wire.endPin.y = endComp.y + eP.y;
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

  onLibraryUpdate(cb: () => void) { this.listeners.push(cb); }
  notify() { this.listeners.forEach(cb => cb()); }
}

export const store = new SchematicStore();