import type { Tool, Pin, ComponentDefinition, ComponentInstance, WorldPin } from '../types/schematic.ts';
import { SpatialIndex } from './spatialIndex.ts';

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
  public activeTool: Tool = 'selection';
  private gridSize = 10;
  public components: ComponentInstance[] = [];
  public selectedComponentIds = new Set<string>();
  public library = new ComponentLibrary();
  public spatialIndex = new SpatialIndex();

  private listeners: Array<() => void> = [];

  snap(value: number): number {
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  setTool(tool: Tool) { this.activeTool = tool; }

  getActiveToolDefinition(): ComponentDefinition | null {
    return this.activeTool === 'component' ? this.library.get('resistor') ?? null : null;
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

  deleteSelected() {
    this.components = this.components.filter(comp => !this.selectedComponentIds.has(comp.id));
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

  onLibraryUpdate(cb: () => void) { this.listeners.push(cb); }
  notify() { this.listeners.forEach(cb => cb()); }
}

export const store = new SchematicStore();