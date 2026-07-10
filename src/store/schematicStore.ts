export type Tool = 'selection' | 'component';
export interface Pin {
  number: string;
  x: number;
  y: number;
}
export interface ComponentDefinition {
  id: string;
  img: HTMLImageElement;
  pins: Pin[];
  width: number;
  height: number;
}
export interface ComponentInstance {
  id: string;
  x: number;
  y: number;
  definition: ComponentDefinition;
}

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
  get(id: string) {
    return this.cache.get(id);
  }
}

class SchematicStore {
  public activeTool: Tool = 'selection';
  private gridSize = 10;
  public components: ComponentInstance[] = [];
  public library = new ComponentLibrary();

  public selectedComponentIds = new Set<string>();

  // --- MISSING METHODS START ---
  snap(value: number): number {
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  setTool(tool: Tool) {
    this.activeTool = tool;
  }
  // --- MISSING METHODS END ---

  getActiveToolDefinition(): ComponentDefinition | null {
    if (this.activeTool === 'component') {
      return this.library.get('resistor') ?? null;
    }
    return null;
  }

  addComponent(x: number, y: number, def: ComponentDefinition) {
    this.components.push({
      id: crypto.randomUUID(),
      x: this.snap(x),
      y: this.snap(y),
      definition: def
    });
  }

  setSelected(id: string | null, multi: boolean = false) {
    if (!multi) {
      this.selectedComponentIds.clear();
    }

    if (id) {
      this.selectedComponentIds.add(id);
    } else if (!multi) {
      this.selectedComponentIds.clear();
    }
  }

  toggleSelection(id: string) {
    if (this.selectedComponentIds.has(id)) {
      this.selectedComponentIds.delete(id);
    } else {
      this.selectedComponentIds.add(id);
    }
  }

  clearSelection() {
    this.selectedComponentIds.clear();
  }

  private listeners: Array<() => void> = [];
  onLibraryUpdate(callback: () => void) {
    this.listeners.push(callback);
  }
  notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const store = new SchematicStore();