import { store } from './schematicStore.ts';
import type { ToolInterface } from '../types/schematic.ts';

export class SelectionTool implements ToolInterface {
  id = 'selection';
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

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

  onMouseUp() {
    this.isDragging = false;
  }

  onClick(e: MouseEvent, worldPos: { x: number, y: number }) {
    const isMultiSelect = e.ctrlKey || e.metaKey;
    const clickedComp = [...store.components].reverse().find(comp =>
      worldPos.x >= comp.x && worldPos.x <= comp.x + comp.definition.width &&
      worldPos.y >= comp.y && worldPos.y <= comp.y + comp.definition.height
    );

    if (clickedComp) {
      if (store.selectedComponentIds.has(clickedComp.id)) return;
      isMultiSelect ? store.toggleSelection(clickedComp.id) : store.setSelected(clickedComp.id, false);
    } else if (!isMultiSelect) {
      store.clearSelection();
    }
  }

  onDraw(ctx: CanvasRenderingContext2D) {
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
  id = 'component';
  // The tool now tracks WHICH component it is currently placing
  public activeComponentId: string = 'resistor';

  // Helper to get the actual definition from the library
  get definition() {
    return store.library.get(this.activeComponentId);
  }

  onClick(e: MouseEvent, worldPos: { x: number, y: number }) {
    const def = this.definition; // Use local property
    if (def) {
      store.addComponent(worldPos.x, worldPos.y, def);
      store.setTool('selection');
    }
  }

  onDraw(ctx: CanvasRenderingContext2D) {
    const def = this.definition; // Use local property
    if (!def) return;

    const { x, y } = store.mousePos;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(def.img, store.snap(x), store.snap(y));
    ctx.restore();
  }
}

export class WiringTool implements ToolInterface {
  id = 'wire';
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
    const pin = this.updatePinProximity(worldPos);
    if (pin) {
      store.pendingWire = { startPin: pin, currentPos: { ...worldPos } };
    }
  }

  onMouseUp(e: MouseEvent, worldPos: { x: number, y: number }) {
    if (store.pendingWire) {
      const endPin = this.updatePinProximity(worldPos);
      if (endPin) {
        const start = store.pendingWire.startPin;
        if (!(endPin.componentId === start.componentId && endPin.pinNumber === start.pinNumber)) {
          store.createWire(start, endPin);
        }
      }
      store.pendingWire = null;
    }
  }

  onDraw(ctx: CanvasRenderingContext2D) {
    const mousePos = store.mousePos;
    const pin = this.updatePinProximity(mousePos);
    if (pin) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    if (store.pendingWire) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)';
      ctx.setLineDash([5, 5]);
      ctx.moveTo(store.pendingWire.startPin.x, store.pendingWire.startPin.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}