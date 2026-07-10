import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { store } from '../store/schematicStore';
import type { WorldPin } from '../types/schematic';
import { CanvasUtils } from '../utils/canvasUtils';

@customElement('schematic-canvas')
export class SchematicCanvas extends LitElement {
  @query('canvas') canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private mousePos = { x: 0, y: 0 };
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };
  private PIN_THRESHOLD = 15;

  firstUpdated() {
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') store.deleteSelected();
    });
    this.renderLoop();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Helper to translate raw event coordinates to Canvas World Space
  private getWorldPos(e: MouseEvent): { x: number, y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  handleMouseDown(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    store.mousePos = worldPos; // Sync for onDraw
    store.activeTool.onMouseDown?.(e, worldPos);
  }

  handleMouseMove(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    this.mousePos = worldPos;
    store.mousePos = worldPos; // Sync for onDraw
    store.activeTool.onMouseMove?.(e, worldPos);
  }

  handleMouseUp(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    store.activeTool.onMouseUp?.(e, worldPos);
  }

  handleClick(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    store.activeTool.onClick?.(e, worldPos);
  }
  private handleSelectionClick(e: MouseEvent) {
    const isMultiSelect = e.ctrlKey || e.metaKey;
    const clickedComp = [...store.components].reverse().find(comp =>
      this.mousePos.x >= comp.x && this.mousePos.x <= comp.x + comp.definition.width &&
      this.mousePos.y >= comp.y && this.mousePos.y <= comp.y + comp.definition.height
    );

    if (clickedComp) {
      if (store.selectedComponentIds.has(clickedComp.id)) return;
      isMultiSelect ? store.toggleSelection(clickedComp.id) : store.setSelected(clickedComp.id, false);
    } else if (!isMultiSelect) {
      store.clearSelection();
    }
  }

  private updatePinProximity(): WorldPin | null {
    const nearby = store.spatialIndex.getNearbyPins(this.mousePos.x, this.mousePos.y);

    for (const pin of nearby) {
      const dx = this.mousePos.x - pin.x;
      const dy = this.mousePos.y - pin.y;
      if (dx * dx + dy * dy < this.PIN_THRESHOLD * this.PIN_THRESHOLD) {
        return pin; // Found it! Return the pin immediately
      }
    }

    return null; // No pin found within threshold
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // IMPORTANT: Update wire positions if components moved
    store.updateWirePositions();

    CanvasUtils.drawGrid(this.ctx, this.canvas.width, this.canvas.height);

    // 1. Draw Wires
    this.ctx.save();
    this.ctx.strokeStyle = '#2c3e50'; // Dark slate for wires
    this.ctx.lineWidth = 2;

    // Draw established wires
    store.wires.forEach(wire => {
      wire.segments.forEach(seg => {
        this.ctx.beginPath();
        this.ctx.moveTo(seg.x1, seg.y1);
        this.ctx.lineTo(seg.x2, seg.y2);
        this.ctx.stroke();
      });
    });

    // Draw pending wire (rubber-banding)
    if (store.pendingWire) {
      this.ctx.beginPath();
      this.ctx.strokeStyle = 'rgba(255, 140, 0, 0.6)'; // Orange for pending
      this.ctx.setLineDash([5, 5]);
      this.ctx.moveTo(store.pendingWire.startPin.x, store.pendingWire.startPin.y);
      this.ctx.lineTo(this.mousePos.x, this.mousePos.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    this.ctx.restore();
    // --- 1. Grid ---
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 0.5; // Explicitly set this every frame
    for (let x = 0; x < this.canvas.width; x += 10) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); }
    for (let y = 0; y < this.canvas.height; y += 10) { this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); }
    this.ctx.stroke();

    // --- 2. Components ---
    store.components.forEach(comp => this.ctx.drawImage(comp.definition.img, comp.x, comp.y));

    store.activeTool.onDraw?.(this.ctx);
  }
  renderLoop() { this.draw(); requestAnimationFrame(() => this.renderLoop()); }

  static styles = css`:host { display: block; width: 100vw; height: 100vh; overflow: hidden; } canvas { display: block; cursor: crosshair; }`;
  render() {
    return html`<canvas @mousemove=${this.handleMouseMove} @mousedown=${this.handleMouseDown} @mouseup=${this.handleMouseUp} @click=${this.handleClick}></canvas>`;
  }
}