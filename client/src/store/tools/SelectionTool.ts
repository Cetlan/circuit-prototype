import type { ToolInterface, ToolId } from '../../types/schematic';
import { store } from '../schematicStore';


export class SelectionTool implements ToolInterface {
  id: ToolId = 'selection';
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private PIN_THRESHOLD = 15;
  private draggingLabel: { compId: string; label: 'refdes' | 'value'; } | null = null;

  private updatePinProximity(mousePos: { x: number; y: number; }) {
    const nearby = store.spatialIndex.getNearbyPins(mousePos.x, mousePos.y);
    for (const pin of nearby) {
      const dx = mousePos.x - pin.x;
      const dy = mousePos.y - pin.y;
      if (dx * dx + dy * dy < this.PIN_THRESHOLD * this.PIN_THRESHOLD) return pin;
    }
    return null;
  }

  private getClickedLabel(worldPos: { x: number; y: number; }) {
    for (const comp of store.components) {
      const { width: w, height: h } = comp.definition;
      const isHorizontal = comp.rotation % 180 === 0;
      const centerX = comp.x + (isHorizontal ? w : h) / 2;
      const centerY = comp.y + (isHorizontal ? h : w) / 2;
      const halfW = (isHorizontal ? w : h) / 2;
      const halfH = (isHorizontal ? h : w) / 2;
      const padding = 20;
      const offset = 15;

      let refdesX = 0, refdesY = 0, valueX = 0, valueY = 0;
      if (isHorizontal) {
        refdesX = centerX + (comp.refdesOffset?.x || 0);
        refdesY = centerY - halfH - padding - offset + (comp.refdesOffset?.y || 0);
        valueX = centerX + (comp.valueOffset?.x || 0);
        valueY = centerY + halfH + padding + offset + (comp.valueOffset?.y || 0);
      } else {
        refdesX = centerX - halfW - padding + (comp.refdesOffset?.x || 0);
        refdesY = centerY + (comp.refdesOffset?.y || 0);
        valueX = centerX + halfW + padding + (comp.valueOffset?.x || 0);
        valueY = centerY + (comp.valueOffset?.y || 0);
      }

      if (Math.abs(worldPos.x - refdesX) < 40 && Math.abs(worldPos.y - refdesY) < 15) {
        return { compId: comp.id, label: 'refdes' as const };
      }
      if (Math.abs(worldPos.x - valueX) < 40 && Math.abs(worldPos.y - valueY) < 15) {
        return { compId: comp.id, label: 'value' as const };
      }
    }
    return null;
  }

  onMouseDown(e: MouseEvent, worldPos: { x: number; y: number; }) {
    const clickedLabel = this.getClickedLabel(worldPos);
    if (clickedLabel) {
      const isMulti = e.ctrlKey || e.metaKey;
      store.setLabelSelected(clickedLabel.compId, clickedLabel.label, isMulti);
      this.draggingLabel = clickedLabel;
      this.lastMousePos = { ...worldPos };
      return;
    }

    const clickedComp = [...store.components].reverse().find(comp => {
      const { width, height } = store.getCurrentDimensions(comp);
      return worldPos.x >= comp.x && worldPos.x <= comp.x + width &&
        worldPos.y >= comp.y && worldPos.y <= comp.y + height;
    });

    if (clickedComp) {
      const isMulti = e.ctrlKey || e.metaKey;
      store.setSelected(clickedComp.id, isMulti);
      this.isDragging = true;
      this.lastMousePos = { ...worldPos };
    }
  }

  onMouseMove(e: MouseEvent, worldPos: { x: number; y: number; }) {
    if (this.draggingLabel) {
      const dx = worldPos.x - this.lastMousePos.x;
      const dy = worldPos.y - this.lastMousePos.y;
      store.updateLabelOffset(this.draggingLabel.compId, this.draggingLabel.label, dx, dy);
      this.lastMousePos = { ...worldPos };
      return;
    }
    if (this.isDragging) {
      const dx = worldPos.x - this.lastMousePos.x;
      const dy = worldPos.y - this.lastMousePos.y;
      if (store.moveSelected(dx, dy)) {
        this.lastMousePos = { ...worldPos };
      }
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.draggingLabel = null;
  }

  onClick(e: MouseEvent, worldPos: { x: number; y: number; }) {
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
    if (this.getClickedLabel(worldPos)) return;

    const clickedComp = [...store.components].reverse().find(comp => {
      const { width, height } = store.getCurrentDimensions(comp);
      return worldPos.x >= comp.x && worldPos.x <= comp.x + width &&
        worldPos.y >= comp.y && worldPos.y <= comp.y + height;
    });
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

    // Draw Label Selections and Tethers
    if (store.selectedLabels.size > 0) {
      ctx.save();
      ctx.strokeStyle = '#007bff';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;

      store.components.forEach(comp => {
        const { width: w, height: h } = comp.definition;
        const isHorizontal = comp.rotation % 180 === 0;
        const centerX = comp.x + (isHorizontal ? w : h) / 2;
        const centerY = comp.y + (isHorizontal ? h : w) / 2;
        const halfW = (isHorizontal ? w : h) / 2;
        const halfH = (isHorizontal ? h : w) / 2;
        const padding = 20;
        const offset = 15;

        let refdesX = 0, refdesY = 0, valueX = 0, valueY = 0;
        if (isHorizontal) {
          refdesX = centerX + (comp.refdesOffset?.x || 0);
          refdesY = centerY - halfH - padding - offset + (comp.refdesOffset?.y || 0);
          valueX = centerX + (comp.valueOffset?.x || 0);
          valueY = centerY + halfH + padding + offset + (comp.valueOffset?.y || 0);
        } else {
          refdesX = centerX - halfW - padding + (comp.refdesOffset?.x || 0);
          refdesY = centerY + (comp.refdesOffset?.y || 0);
          valueX = centerX + halfW + padding + (comp.valueOffset?.x || 0);
          valueY = centerY + (comp.valueOffset?.y || 0);
        }

        if (store.selectedLabels.has(`${comp.id}:refdes`)) {
          ctx.beginPath();
          ctx.moveTo(refdesX, refdesY);
          ctx.lineTo(centerX, centerY);
          ctx.stroke();
          ctx.strokeRect(refdesX - 40, refdesY - 15, 80, 30);
        }
        if (store.selectedLabels.has(`${comp.id}:value`)) {
          ctx.beginPath();
          ctx.moveTo(valueX, valueY);
          ctx.lineTo(centerX, centerY);
          ctx.stroke();
          ctx.strokeRect(valueX - 40, valueY - 15, 80, 30);
        }
      });
      ctx.restore();
    }

    // Draw Component Selections
    if (store.selectedComponentIds.size > 0) {
      ctx.save();
      ctx.strokeStyle = '#007bff';
      ctx.setLineDash([5, 5]);
      store.components.forEach(comp => {
        if (store.selectedComponentIds.has(comp.id)) {
          const { width, height } = store.getCurrentDimensions(comp);
          ctx.strokeRect(comp.x - 2, comp.y - 2, width + 4, height + 4);
        }
      });
      ctx.restore();
    }
  }
}
