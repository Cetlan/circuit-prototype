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
    if (store.activeTool === 'component') {
      const def = store.getActiveToolDefinition();
      if (def) {
        store.addComponent(this.mousePos.x, this.mousePos.y, def);
        store.setTool('selection');
      }
    } else if (store.activeTool === 'selection') {
      this.handleSelectionClick(e);
    }
  }

  private handleSelectionClick(e: MouseEvent) {
    const isMultiSelect = e.ctrlKey || e.metaKey;

    const clickedComp = [...store.components].reverse().find(comp => {
      const { width, height } = comp.definition;
      return (
        this.mousePos.x >= comp.x &&
        this.mousePos.x <= comp.x + width &&
        this.mousePos.y >= comp.y &&
        this.mousePos.y <= comp.y + height
      );
    });

    if (clickedComp) {
      if (isMultiSelect) {
        store.toggleSelection(clickedComp.id);
      } else {
        store.setSelected(clickedComp.id, false);
      }
    } else {
      // If we click empty space, clear selection UNLESS we are holding Ctrl
      if (!isMultiSelect) {
        store.clearSelection();
      }
    }
  }

  draw() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();

    // 1. Draw components
    store.components.forEach(comp => {
      this.ctx.drawImage(comp.definition.img, comp.x, comp.y);
    });

    // 2. Draw Multi-Selection Highlights
    if (store.selectedComponentIds.size > 0) {
      this.ctx.strokeStyle = '#007bff';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);

      store.components.forEach(comp => {
        if (store.selectedComponentIds.has(comp.id)) {
          const { width, height } = comp.definition;
          this.ctx.strokeRect(comp.x - 2, comp.y - 2, width + 4, height + 4);
        }
      });
      this.ctx.setLineDash([]);
    }

    // 3. Draw Ghost
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