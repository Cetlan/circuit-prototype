import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { store } from '../store/schematicStore';

@customElement('schematic-canvas')
export class SchematicCanvas extends LitElement {
  @query('canvas') canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private mousePos = { x: 0, y: 0 };
  private ghostImg: HTMLImageElement | null = null;

  firstUpdated() {
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderLoop();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  handleMouseMove(e: MouseEvent) {
    this.mousePos = { x: e.clientX, y: e.clientY };
  }


  drawGrid() {
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 0.5;

    for (let x = 0; x < this.canvas.width; x += 10) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
    }
    for (let y = 0; y < this.canvas.height; y += 10) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
    }
    this.ctx.stroke();
  }

  handleClick(e: MouseEvent) {
    const def = store.getActiveToolDefinition();
    if (store.activeTool === 'component' && def) {
      store.addComponent(this.mousePos.x, this.mousePos.y, def);
      store.setTool('selection');
    }
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();

    // Draw placed components
    store.components.forEach(comp => {
      const { img, pins } = comp.definition;
      this.ctx.drawImage(img, comp.x, comp.y);

      // OPTIONAL: Visual check - draw a tiny red dot on every pin
      this.ctx.fillStyle = 'red';
      pins.forEach(pin => {
        this.ctx.beginPath();
        this.ctx.arc(comp.x + pin.x, comp.y + pin.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      });
    });

    const ghostDef = store.getActiveToolDefinition();
    if (ghostDef) {
      const snappedX = store.snap(this.mousePos.x);
      const snappedY = store.snap(this.mousePos.y);
      this.ctx.globalAlpha = 0.5;
      this.ctx.drawImage(ghostDef.img, snappedX, snappedY);
      this.ctx.globalAlpha = 1.0;
    }
  }

  renderLoop() {
    this.draw();
    requestAnimationFrame(() => this.renderLoop());
  }

  static styles = css`
        :host { display: block; width: 100vw; height: 100vh; overflow: hidden; }
        canvas { display: block; cursor: crosshair; }
    `;

  render() {
    return html`
            <canvas 
                @mousemove=${this.handleMouseMove} 
                @click=${this.handleClick}>
            </canvas>
        `;
  }
}