import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { store } from '../store/schematicStore.ts';
import { CanvasUtils } from '../utils/canvasUtils.ts';

@customElement('schematic-canvas')
export class SchematicCanvas extends LitElement {
  @query('canvas') canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private mousePos = { x: 0, y: 0 };
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

  firstUpdated() {
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') store.deleteSelected();
      if (e.key === 'r' || e.key === 'R') store.rotateSelected();
      if (e.key === 'Escape') {
        // TODO: Implement a more comprehensive tool notification system 
        // so tools can perform their own cleanup when disabled.
        store.setTool('selection');
        store.pendingWire = null;
      }
    });
    this.renderLoop();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private getWorldPos(e: MouseEvent): { x: number, y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  handleMouseDown(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    store.mousePos = worldPos;
    store.activeTool.onMouseDown?.(e, worldPos);
  }

  handleMouseMove(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    this.mousePos = worldPos;
    store.mousePos = worldPos;
    store.activeTool.onMouseMove?.(e, worldPos);
  }

  handleMouseUp(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    store.activeTool.onMouseUp?.(e, worldPos);
  }

  handleClick(e: MouseEvent) {
    const worldPos = this.getWorldPos(e);
    const result = store.activeTool.onClick?.(e, worldPos);

    if (result?.status === 'completed') {
      store.setTool('selection');
    } else if (result?.status === 'pinClicked') {
      store.setTool('wire');
      store.pendingWire = { startPin: result.pin, viaPoints: [], currentPos: worldPos };
    }
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    store.updateWirePositions();
    CanvasUtils.drawGrid(this.ctx, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.strokeStyle = '#059669';
    this.ctx.lineWidth = 2;
    store.wires.forEach(wire => {
      wire.segments.forEach(seg => {
        this.ctx.beginPath();
        this.ctx.moveTo(seg.x1, seg.y1);
        this.ctx.lineTo(seg.x2, seg.y2);
        this.ctx.stroke();
      });
    });
    this.ctx.restore();

    // 1. Identify all connected pins
    const connectedPins = new Set<string>();
    store.wires.forEach(wire => {
      connectedPins.add(`${wire.startPin.componentId}:${wire.startPin.pinNumber}`);
      connectedPins.add(`${wire.endPin.componentId}:${wire.endPin.pinNumber}`);
    });

    store.components.forEach(comp => {
      const { width: w, height: h, img } = comp.definition;
      const centerX = comp.x + (comp.rotation % 180 === 0 ? w : h) / 2;
      const centerY = comp.y + (comp.rotation % 180 === 0 ? h : w) / 2;

      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.rotate((comp.rotation * Math.PI) / 180);
      this.ctx.drawImage(img, -w / 2, -h / 2);
      this.ctx.restore();
    });

    // 2. Draw red dots for unconnected pins
    this.ctx.save();
    this.ctx.fillStyle = 'red';
    store.components.forEach(comp => {
      comp.definition.pins.forEach(pin => {
        if (!connectedPins.has(`${comp.id}:${pin.number}`)) {
          const pos = store.getPinWorldPos(comp, pin);
          this.ctx.beginPath();
          this.ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      });
    });
    this.ctx.restore();

    store.activeTool.onDraw?.(this.ctx);
  }

  renderLoop() { this.draw(); requestAnimationFrame(() => this.renderLoop()); }

  static styles = css`:host { display: block; width: 100vw; height: 100vh; overflow: hidden; } canvas { display: block; cursor: crosshair; }`;
  render() {
    return html`<canvas @mousedown=${this.handleMouseDown} @mousemove=${this.handleMouseMove} @mouseup=${this.handleMouseUp} @click=${this.handleClick}></canvas>`;
  }
}