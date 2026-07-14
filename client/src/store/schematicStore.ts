import type { ToolId, Pin, ComponentDefinition, ComponentInstance, WorldPin, Wire, WireSegment, ToolInterface } from '../types/schematic.ts';
import { SpatialIndex } from './spatialIndex.ts';
import { router } from '../services/router.ts';
import { circuitManager } from '../services/circuitManager.ts';
import { WiringTool } from './tools/WiringTool.ts';
import { PlacementTool } from './tools/PlacementTool.ts';
import { SelectionTool } from './tools/SelectionTool.ts';
import { defaultLabelPlacementStrategy } from '../utils/labelPlacement.ts';
import { ComponentDescriptor, isInlineSymbol } from '../symbols/types.ts';

class ComponentLibrary {
  private cache = new Map<string, ComponentDefinition>();
  async loadComponent(descriptor: ComponentDescriptor, svgString: string, colorOverrides?: Record<string, string>): Promise<ComponentDefinition> {
    if (this.cache.has(descriptor.id)) return this.cache.get(descriptor.id)!;

    const DEFAULT_COLOR = '#333333';

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) throw new Error(`Invalid SVG for component ${descriptor.id}`);

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
        const def: ComponentDefinition = { ...descriptor, img, pins, width, height };
        this.cache.set(descriptor.id, def);
        resolve(def);
      };
      img.onerror = reject;
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(modifiedSvgString)}`;
    });
  }

  async fetchComponent(id: string, url: string, colorOverrides?: Record<string, string>): Promise<ComponentDefinition> {
    const componentResponse = await fetch(url)
    if (!componentResponse.ok) throw new Error(`Failed to fetch component details for ${id} from ${url}`);
    const componentDetails = (await componentResponse.json()) as ComponentDescriptor;

    // Ensure the descriptor has the ID passed from the request, 
    // as the server-side JSON files may not include it.
    componentDetails.id = id;

    const symbolDetails = componentDetails.symbol;
    const defaultSymbol = symbolDetails["IEEE"];

    if (isInlineSymbol(defaultSymbol)) {
      return this.loadComponent(componentDetails, defaultSymbol.data, colorOverrides);
    }
    else {
      const svgResponse = await fetch(defaultSymbol.url);
      const svgString = await svgResponse.text();
      return this.loadComponent(componentDetails, svgString, colorOverrides);
    }
  }

  get(id: string) { return this.cache.get(id); }
  getIds() { return Array.from(this.cache.keys()); }
}

export class SchematicStore {
  // 1. Declare types without assigning values immediately
  public tools!: Record<ToolId, ToolInterface>;
  public activeTool!: ToolInterface;

  private gridSize = 10;
  public components: ComponentInstance[] = [];
  public selectedComponentIds = new Set<string>();
  public selectedLabels = new Set<string>(); // Format: "compId:refdes" or "compId:value"
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

  getCurrentDimensions(comp: ComponentInstance): { width: number, height: number } {
    const { width, height } = comp.definition;
    return comp.rotation % 180 === 0 ? { width, height } : { width: height, height: width };
  }

  getComponentCenter(comp: ComponentInstance): { x: number, y: number } {
    const { width, height } = this.getCurrentDimensions(comp);
    return { x: comp.x + width / 2, y: comp.y + height / 2 };
  }

  getPinWorldPos(comp: ComponentInstance, pin: Pin): { x: number, y: number } {
    const center = this.getComponentCenter(comp);
    const localX = pin.x - comp.definition.width / 2;
    const localY = pin.y - comp.definition.height / 2;

    let rotatedX = localX;
    let rotatedY = localY;

    const angle = comp.rotation % 360;
    if (angle === 90) {
      rotatedX = -localY;
      rotatedY = localX;
    } else if (angle === 180) {
      rotatedX = -localX;
      rotatedY = -localY;
    } else if (angle === 270) {
      rotatedX = localY;
      rotatedY = -localX;
    }

    return { x: center.x + rotatedX, y: center.y + rotatedY };
  }

  rotateSelected() {
    let moved = false;
    this.components.forEach(comp => {
      if (this.selectedComponentIds.has(comp.id)) {
        const center = this.getComponentCenter(comp);
        const px = this.snap(center.x);
        const py = this.snap(center.y);

        // Rotate center around (px, py)
        const nextCenterX = px - (center.y - py);
        const nextCenterY = py + (center.x - px);

        const nextRotation = (comp.rotation + 90) % 360;
        const { width: nextW, height: nextH } = this.getCurrentDimensions({ ...comp, rotation: nextRotation });

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

  setTool(toolId: ToolId) {
    this.activeTool = this.tools[toolId];
    this.notify();
  }

  updateSpatialIndex() {
    this.spatialIndex.clear();
    this.components.forEach(comp => {
      comp.definition.pins.forEach(pin => {
        const pos = this.getPinWorldPos(comp, pin);
        this.spatialIndex.addPin({ componentId: comp.id, pinNumber: pin.number, x: pos.x, y: pos.y });
      });
    });
  }

  addComponent(x: number, y: number, def: ComponentDefinition, refdes?: string, value?: string) {
    let finalRefdes = refdes;
    if (!finalRefdes) {
      const prefix = def.prefix;
      const existingNumbers = this.components
        .filter(c => c.refdes.startsWith(prefix))
        .map(c => parseInt(c.refdes.slice(prefix.length)) || 0);
      const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      finalRefdes = `${prefix}${maxNum + 1}`;
    }

    const finalValue = String(value ?? def.properties?.value?.default ?? '1K');

    circuitManager.addComponent(
      finalRefdes,
      { engine: 'spice', target: def.id, pins: def.pins.map(p => p.number as any) },
      def.pins.map(p => p.number as any),
      { value: finalValue }
    );

    this.components.push({
      id: crypto.randomUUID(),
      x: this.snap(x),
      y: this.snap(y),
      rotation: 0,
      definition: def,
      refdes: finalRefdes,
      value: finalValue
    });
    this.updateSpatialIndex();
  }

  moveSelected(dx: number, dy: number): boolean {
    let anyMoved = false;
    this.components.forEach(comp => {
      if (this.selectedComponentIds.has(comp.id)) {
        const newX = this.snap(comp.x + dx);
        const newY = this.snap(comp.y + dy);
        if (newX !== comp.x || newY !== comp.y) {
          comp.x = newX;
          comp.y = newY;
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

  updateLabelOffset(compId: string, label: 'refdes' | 'value', dx: number, dy: number) {
    const comp = this.components.find(c => c.id === compId);
    if (!comp) return;

    if (label === 'refdes') {
      comp.refdesOffset = { x: (comp.refdesOffset?.x || 0) + dx, y: (comp.refdesOffset?.y || 0) + dy };
    } else {
      comp.valueOffset = { x: (comp.valueOffset?.x || 0) + dx, y: (comp.valueOffset?.y || 0) + dy };
    }
    this.notify();
  }

  deleteSelected() {
    const deletedIds = new Set(this.selectedComponentIds);

    this.components.forEach(comp => {
      if (deletedIds.has(comp.id)) {
        circuitManager.removeComponent(comp.refdes);
      }
    });

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

  clearSelection() {
    this.selectedComponentIds.clear();
    this.selectedLabels.clear();
  }

  setLabelSelected(compId: string, type: 'refdes' | 'value', multi: boolean = false) {
    if (!multi) this.selectedLabels.clear();
    this.selectedLabels.add(`${compId}:${type}`);
  }

  toggleLabelSelection(compId: string, type: 'refdes' | 'value') {
    const key = `${compId}:${type}`;
    this.selectedLabels.has(key) ? this.selectedLabels.delete(key) : this.selectedLabels.add(key);
  }

  createWire(start: WorldPin, end: WorldPin, providedSegments?: WireSegment[]) {
    const startComp = this.components.find(c => c.id === start.componentId);
    const endComp = this.components.find(c => c.id === end.componentId);

    if (startComp && endComp) {
      circuitManager.connectComponentPins(
        startComp.refdes, start.pinNumber,
        endComp.refdes, end.pinNumber
      );
    }

    const segments = providedSegments || router.route(start, end, this.generateCostMap());
    const finalSegments = segments.length > 0 ? segments : [{ id: crypto.randomUUID(), x1: start.x, y1: start.y, x2: end.x, y2: end.y }];
    this.wires.push({ id: crypto.randomUUID(), startPin: start, endPin: end, segments: finalSegments });
  }

  generateCostMap(): Record<string, number> {
    const costMap: Record<string, number> = {};
    this.components.forEach(comp => {
      const w = (comp.rotation % 180 === 0) ? comp.definition.width : comp.definition.height;
      const h = (comp.rotation % 180 === 0) ? comp.definition.height : comp.definition.width;
      for (let x = comp.x; x <= comp.x + w; x += 10) {
        for (let y = comp.y; y <= comp.y + h; y += 10) {
          costMap[`${x},${y}`] = 100;
        }
      }
      comp.definition.pins.forEach(p => {
        const pos = this.getPinWorldPos(comp, p);
        costMap[`${pos.x},${pos.y}`] = 200;
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

        const startPos = this.getPinWorldPos(startComp, sP);
        const endPos = this.getPinWorldPos(endComp, eP);

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

  onLibraryUpdate(cb: () => void) { this.listeners.push(cb); }
  notify() { this.listeners.forEach(cb => cb()); }
}

export const store = new SchematicStore();