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

  handleMouseMove(e: MouseEvent) {
    this.mousePos = { x: e.clientX, y: e.clientY };

    // Update cursor based on wiring proximity
    if (store.activeTool === 'wire') {
      const pin = this.updatePinProximity();
      this.canvas.style.cursor = pin ? 'pointer' : 'crosshair';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }

    if (this.isDragging) {
      const dx = this.mousePos.x - this.lastMousePos.x;
      const dy = this.mousePos.y - this.lastMousePos.y;
      store.moveSelected(dx, dy);
      this.lastMousePos = { ...this.mousePos };
    }
  }

  handleMouseDown(e: MouseEvent) {
    // 1. WIRING MODE
    if (store.activeTool === 'wire') {
      const pin = this.updatePinProximity();
      if (pin) {
        // Start the "rubber band" wire
        store.pendingWire = {
          startPin: pin,
          currentPos: { ...this.mousePos }
        };
        // Stop the event from triggering other behaviors
        e.stopPropagation();
        return;
      }
    }

    // 2. SELECTION MODE
    if (store.activeTool === 'selection') {
      this.handleSelectionClick(e);

      const clickedSomething = store.components.some(comp =>
        this.mousePos.x >= comp.x && this.mousePos.x <= comp.x + comp.definition.width &&
        this.mousePos.y >= comp.y && this.mousePos.y <= comp.y + comp.definition.height
      );

      if (store.selectedComponentIds.size > 0 && clickedSomething) {
        this.isDragging = true;
        this.lastMousePos = { ...this.mousePos };
      }
    }
  }

  handleMouseUp(e: MouseEvent) {
    this.isDragging = false;

    if (store.activeTool === 'wire' && store.pendingWire) {
      const endPin = this.updatePinProximity();

      if (endPin) {
        const start = store.pendingWire.startPin;
        const isSamePin =
          endPin.componentId === start.componentId &&
          endPin.pinNumber === start.pinNumber;

        if (!isSamePin) {
          store.createWire(start, endPin);
        }
      }
      // Always clear the pending wire once the mouse is released
      store.pendingWire = null;
    }
  }

  handleClick(e: MouseEvent) {
    // The ONLY thing handleClick should do now is Component Placement.
    // Selection and Wiring are now handled by MouseDown/Up for better responsiveness.
    if (store.activeTool === 'component') {
      const def = store.getActiveToolDefinition();
      if (def) {
        store.addComponent(this.mousePos.x, this.mousePos.y, def);
        store.setTool('selection');
      }
    }
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

    // --- 3. Selection ---
    if (store.selectedComponentIds.size > 0) {
      this.ctx.save(); // Save the current state (colors, lineWidth)
      this.ctx.strokeStyle = '#007bff';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      store.components.forEach(comp => {
        if (store.selectedComponentIds.has(comp.id)) {
          this.ctx.strokeRect(comp.x - 2, comp.y - 2, comp.definition.width + 4, comp.definition.height + 4);
        }
      });
      this.ctx.restore(); // Restore state to exactly how it was before this block
    }

    // Wiring Tool
    if (store.activeTool === 'wire') {
      const pin = this.updatePinProximity();
      if (pin) {
        this.ctx.save();

        // 1. THE CONTRAST RING (The "Edge")
        // A slightly larger, thin black circle that defines the boundary
        // so the orange doesn't bleed into the white background.
        this.ctx.beginPath();
        this.ctx.arc(pin.x, pin.y, 9, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // 2. THE MAIN SIGNAL (The "Glow")
        // Using a vibrant, saturated orange (#FF8C00) which 
        // has much higher contrast on white than yellow does.
        this.ctx.beginPath();
        this.ctx.arc(pin.x, pin.y, 7, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#FF8C00';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // 3. THE CORE (The "Fill")
        // A semi-transparent orange fill for a "button" feel.
        this.ctx.beginPath();
        this.ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 140, 0, 0.5)';
        this.ctx.fill();

        // 4. THE CENTER POINT
        this.ctx.beginPath();
        this.ctx.arc(pin.x, pin.y, 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = 'black';
        this.ctx.fill();

        this.ctx.restore();
      }
    }

    // --- 5. Ghost ---
    const ghost = store.getActiveToolDefinition();
    if (ghost) {
      this.ctx.globalAlpha = 0.5;
      this.ctx.drawImage(ghost.img, store.snap(this.mousePos.x), store.snap(this.mousePos.y));
      this.ctx.globalAlpha = 1.0;
    }
  }
  renderLoop() { this.draw(); requestAnimationFrame(() => this.renderLoop()); }

  static styles = css`:host { display: block; width: 100vw; height: 100vh; overflow: hidden; } canvas { display: block; cursor: crosshair; }`;
  render() {
    return html`<canvas @mousemove=${this.handleMouseMove} @mousedown=${this.handleMouseDown} @mouseup=${this.handleMouseUp} @click=${this.handleClick}></canvas>`;
  }
}