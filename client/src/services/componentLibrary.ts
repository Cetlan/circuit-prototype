import type { ComponentDefinition, ComponentDescriptor } from '../types/schematic.ts';
import { isInlineSymbol } from '../symbols/types.ts';

class ComponentLibrary {
  private cache = new Map<string, ComponentDefinition>();

  async loadComponent(descriptor: ComponentDescriptor, svgString: string, colorOverrides?: Record<string, string>): Promise<ComponentDefinition> {
    if (this.cache.has(descriptor.id)) return this.cache.get(descriptor.id)!;

    const DEFAULT_COLOR = '#333333';

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) throw new Error(`Invalid SVG for component ${descriptor.id}`);

    const allElements = svgDoc.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = ['fill', 'stroke'];
      attrs.forEach(attr => {
        const val = el.getAttribute(attr);
        if (val && val !== 'none') {
          if (colorOverrides && colorOverrides[val]) {
            el.setAttribute(attr, colorOverrides[val]);
          } else if (!colorOverrides) {
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
    const pins = Array.from(pinElements).map(el => {
      const circle = el as SVGCircleElement;
      return { number: circle.getAttribute('data-pin-number') || '?', x: parseFloat(circle.getAttribute('cx') || '0'), y: parseFloat(circle.getAttribute('cy') || '0') };
    });

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
    const componentResponse = await fetch(url);
    if (!componentResponse.ok) throw new Error(`Failed to fetch component details for ${id} from ${url}`);
    const componentDetails = (await componentResponse.json()) as ComponentDescriptor;

    componentDetails.id = id;
    const symbolDetails = componentDetails.symbol;
    const defaultSymbol = symbolDetails["IEEE"];

    if (isInlineSymbol(defaultSymbol)) {
      return this.loadComponent(componentDetails, defaultSymbol.data, colorOverrides);
    } else {
      const svgResponse = await fetch(defaultSymbol.url);
      const svgString = await svgResponse.text();
      return this.loadComponent(componentDetails, svgString, colorOverrides);
    }
  }

  get(id: string) { return this.cache.get(id); }
  getIds() { return Array.from(this.cache.keys()); }
}

export const componentLibrary = new ComponentLibrary();