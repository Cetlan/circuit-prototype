import type { ToolInterface, ToolId, WireSegment } from '../../types/schematic';
import { store } from '../schematicStore';
import { commandManager } from '../../services/commandManager';
import { AddWireCommand } from '../../services/schematicCommands';


export class WiringTool implements ToolInterface {
  id: ToolId = 'wire';
  private PIN_THRESHOLD = 15;
  private previewSegments: WireSegment[] = [];
  private isCalculating = false;
  private worker = new Worker(new URL('../../services/router.worker.ts', import.meta.url), { type: 'module' });

  constructor() {
    this.worker.onmessage = (e) => {
      this.previewSegments = e.data;
      this.isCalculating = false;
    };
  }

  private updatePinProximity(mousePos: { x: number; y: number; }) {
    const nearby = store.spatialIndex.getNearbyPins(mousePos.x, mousePos.y);
    for (const pin of nearby) {
      const dx = mousePos.x - pin.x;
      const dy = mousePos.y - pin.y;
      if (dx * dx + dy * dy < this.PIN_THRESHOLD * this.PIN_THRESHOLD) return pin;
    }
    return null;
  }

  onClick(e: MouseEvent, worldPos: { x: number; y: number; }) {
    const pin = this.updatePinProximity(worldPos);

    if (store.pendingWire) {
      if (pin) {
        const start = store.pendingWire.startPin;
        if (pin.componentId === start.componentId && pin.pinNumber === start.pinNumber) {
          return; // Ignore click on start pin
        }
        // Finalize wire and return completed status to switch tool
        commandManager.execute(new AddWireCommand(start, pin, this.previewSegments));
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
        ctx.strokeStyle = hoveredPin ? 'rgba(5, 150, 105, 0.9)' : 'rgba(5, 150, 105, 0.4)';
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
