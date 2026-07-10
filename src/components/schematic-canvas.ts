import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { store } from '../store/schematicStore';

@customElement('schematic-canvas')
export class SchematicCanvas extends LitElement {
  @query('canvas') canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private mousePos = { x: 0, y: 0 };

  // Dragging state
  private isDragging = false;
  private lastMousePos = { x: 0, y: 0 };

  firstUpdated() {
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Listen for Delete key globally
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        store.deleteSelected();
      }
    });

    this.renderLoop();
  }

  handleMouseMove(e: MouseEvent) {
    this.mousePos = { x: e.clientX, y: e.clientY };

    if (this.isDragging) {
      // Calculate how far the mouse moved since the last frame
      const dx = this.mousePos.x - this.lastMousePos.x;
      const dy = this.mousePos.y - this.lastMousePos.y;

      store.moveSelected(dx, dy);

      // Update last position for the next frame
      this.lastMousePos = { ...this.mousePos };
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
      // FIX: If the clicked item is already selected, do nothing to the selection set.
      // This allows us to maintain a multi-selection group and start dragging.
      if (store.selectedComponentIds.has(clickedComp.id)) {
        return;
      }

      if (isMultiSelect) {
        store.toggleSelection(clickedComp.id);
      } else {
        store.setSelected(clickedComp.id, false);
      }
    } else {
      if (!isMultiSelect) {
        store.clearSelection();
      }
    }
  }

  handleMouseDown(e: MouseEvent) {
    if (store.activeTool === 'selection') {
      // 1. Determine selection changes based on the click
      this.handleSelectionClick(e);

      // 2. Check if the final state of selection includes the item we just clicked
      // Or if we clicked into an already existing selection group
      const isSomethingSelected = store.selectedComponentIds.size > 0;

      // To ensure we only drag when clicking a selected object (and not empty space 
      // that happened to have a selection existing elsewhere):
      const clickedSomething = [...store.components].reverse().some(comp => {
        const { width, height } = comp.definition;
        return (
          this.mousePos.x >= comp.x &&
          this.mousePos.x <= comp.x + width &&
          this.mousePos.y >= comp.y &&
          this.mousePos.y <= comp.y + height
        );
      });

      if (isSomethingSelected && clickedSomething) {
        this.isDragging = true;
        this.lastMousePos = { ...this.mousePos };
      }
    }
  }
  handleMouseUp() {
    this.isDragging = false;
  }

  // Updated handleClick to handle the initial click/select
  // (We move logic into handleMouseDown/Up for dragging)
  handleClick(e: MouseEvent) {
    if (store.activeTool === 'component') {
      const def = store.getActiveToolDefinition();
      if (def) {
        store.addComponent(this.mousePos.x, this.mousePos.y, def);
        store.setTool('selection');
      }
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
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
                @mousedown=${this.handleMouseDown}
                @mouseup=${this.handleMouseUp}
                @click=${this.handleClick}>
            </canvas>
        `;
  }
}