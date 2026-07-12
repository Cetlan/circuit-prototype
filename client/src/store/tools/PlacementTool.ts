import type { ToolInterface, ToolId } from '../../types/schematic';
import { store } from '../schematicStore';


export class PlacementTool implements ToolInterface {
  id: ToolId = 'component';
  public activeComponentId: string = 'resistor';
  get definition() { return store.library.get(this.activeComponentId); }

  setComponent(id: string) {
    this.activeComponentId = id;
    store.notify();
  }

  onClick(e: MouseEvent, worldPos: { x: number; y: number; }) {
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
