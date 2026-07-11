import { store } from './schematicStore.ts';
import type { ToolInterface, WorldPin, WireSegment, ToolId } from '../types/schematic.ts';

export class SelectionTool implements ToolInterface {
  id: ToolId = 'selection';
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private PIN_THRESHOLD = 15;

  private updatePinProximity(mousePos: { x: number, y: number }) {
    const nearby = store.spatialIndex.getNearbyPins(mousePos.x, mousePos.y);
    for (const pin of nearby) {
      const dx = mousePos.x - pin.x;
      const dy = mousePos.y - pin.y;
      if (dx * dx + dy * dy < this.PIN_THRESHOLD * this.PIN_THRESHOLD) return pin;
    }
    return null;
  }

  onMouseDown(e: MouseEvent, worldPos: { x: number, y: number }) {
    const clickedSomething = store.components.some(comp =>
      worldPos.x >= comp.x && worldPos.x <= comp.x + comp.definition.width &&
      worldPos.y >= comp.y && worldPos.y <= comp.y + comp.definition.height
    );
    if (store.selectedComponentIds.size > 0 && clickedSomething) {
      this.isDragging = true;
      this.lastMousePos = { ...worldPos };
    }
  }

  onMouseMove(e: MouseEvent, worldPos: { x: number, y: number }) {
    if (this.isDragging) {
      const dx = worldPos.x - this.lastMousePos.x;
      const dy = worldPos.y - this.lastMousePos.y;
      store.moveSelected(dx, dy);
      this.lastMousePos = { ...worldPos };
    }
  }

  onMouseUp() { this.isDragging = false; }

  onClick(e: MouseEvent, worldPos: { x: number, y: number }) {
    const PIN_THRESHOLD = 15;
    const nearby = store.spatialIndex.getNearbyPins(worldPos.x, worldPos.y);
    for (const pin of nearby) {
      const dx = worldPos.x - pin.x;
      const dy = worldPos.y - pin.y;
      if (dx * dx + dy * dy < PIN_THRESHOLD * PIN_THRESHOLD) {
        return { status: 'pinClicked', pin } as const;
      }
    }

    const isMultiSelect = e.ctrlKey || e.metaKey;
    const clickedComp = [...store.components].reverse().find(comp =>
      worldPos.x >= comp.x && worldPos.x <= comp.x + comp.definition.width &&
      worldPos.y >= comp.y && worldPos.y <= comp.definition.height
    );
    if (clickedComp) {
      if (store.selectedComponentIds.has(clickedComp.id)) return;
      isMultiSelect ? store.toggleSelection(clickedComp.id) : store.setSelected(clickedComp.id, false);
    } else if (!isMultiSelect) {
      store.clearSelection();
    }
  }

  onDraw(ctx: CanvasRenderingContext2D) {
    const mousePos = store.mousePos;
    const hoveredPin = this.updatePinProximity(mousePos);
    if (hoveredPin) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(hoveredPin.x, hoveredPin.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hoveredPin.x, hoveredPin.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    if (store.selectedComponentIds.size === 0) return;
    ctx.save();
    ctx.strokeStyle = '#007bff';
    ctx.setLineDash([5, 5]);
    store.components.forEach(comp => {
      if (store.selectedComponentIds.has(comp.id)) {
        ctx.strokeRect(comp.x - 2, comp.y - 2, comp.definition.width + 4, comp.definition.height + 4);
      }
    });
    ctx.restore();
  }
}

export class PlacementTool implements ToolInterface {
  id: ToolId = 'component';
  public activeComponentId: string = 'resistor';
  get definition() { return store.library.get(this.activeComponentId); }

  onClick(e: MouseEvent, worldPos: { x: number, y: number }) {
    const def = this.definition;
    if (def) {
      store.addComponent(worldPos.x, worldPos.y, def);
      return { status: 'completed' } as const;
    }
  }

  onDraw(ctx: CanvasRenderingContext2D) {
    const def = this.definition;
    if (!def) return;
    const { x, y } = store.mousePos;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(def.img, store.snap(x), store.snap(y));
    ctx.restore();
  }
}

export class WiringTool implements ToolInterface {
  id: ToolId = 'wire';
  private PIN_THRESHOLD = 15;
  private previewSegments: WireSegment[] = [];
  private isCalculating = false;
  private worker = new Worker(new URL('../services/router.worker.ts', import.meta.url), { type: 'module' });

  constructor() {
    this.worker.onmessage = (e) => {
      this.previewSegments = e.data;
      this.isCalculating = false;
    };
  }

  private updatePinProximity(mousePos: { x: number, y: number }) {
    const nearby = store.spatialIndex.getNearbyPins(mousePos.x, mousePos.y);
    for (const pin of nearby) {
      const dx = mousePos.x - pin.x;
      const dy = mousePos.y - pin.y;
      if (dx * dx + dy * dy < this.PIN_THRESHOLD * this.PIN_THRESHOLD) return pin;
    }
    return null;
  }

  onClick(e: MouseEvent, worldPos: { x: number, y: number }) {
    const pin = this.updatePinProximity(worldPos);

    if (store.pendingWire) {
      if (pin) {
        const start = store.pendingWire.startPin;
        if (pin.componentId === start.componentId && pin.pinNumber === start.pinNumber) {
          return; // Ignore click on start pin
        }
        // Finalize wire and return completed status to switch tool
        store.createWire(start, pin, this.previewSegments);
        store.pendingWire = null;
        return { status: 'completed' } as const;
      } else {
        // Add via-point on empty space click, snapped to grid
        store.pendingWire.viaPoints.push({
          x: store.snap(worldPos.x),
          y: store.snap(worldPos.y)
        });
      }
    } else if (pin) {
      // Start new wire on pin click
      store.pendingWire = { startPin: pin, viaPoints: [], currentPos: { ...worldPos } };
    }
  }

  onDraw(ctx: CanvasRenderingContext2D) {
    const mousePos = store.mousePos;
    const hoveredPin = this.updatePinProximity(mousePos);
    if (hoveredPin) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(hoveredPin.x, hoveredPin.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hoveredPin.x, hoveredPin.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    if (store.pendingWire) {
      const points = [
        store.pendingWire.startPin,
        ...store.pendingWire.viaPoints,
        hoveredPin ? hoveredPin : {
          componentId: 'virtual', pinNumber: '0', x: store.snap(mousePos.x), y: store.snap(mousePos.y)
        }
      ];

      if (!this.isCalculating) {
        this.isCalculating = true;
        this.worker.postMessage({
          points,
          costMap: store.generateCostMap()
        });
      }

      if (this.previewSegments.length > 0) {
        ctx.save();
        ctx.strokeStyle = hoveredPin ? 'rgba(255, 140, 0, 0.9)' : 'rgba(255, 140, 0, 0.4)';
        ctx.lineWidth = 2;
        if (!hoveredPin) ctx.setLineDash([5, 5]);
        this.previewSegments.forEach(seg => {
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        });
        ctx.restore();
      }
    }
  }
}