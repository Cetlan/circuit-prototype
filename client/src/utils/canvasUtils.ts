export class CanvasUtils {
  /**
   * Draws a standard schematic grid.
   * @param ctx The canvas context to draw upon.
   * @param width Canvas width.
   * @param height Canvas height.
   * @param step The distance between grid lines (e.g., 10).
   * @param color The stroke color of the grid.
   */
  static drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, step: number = 10, color: string = '#e0e0e0') {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    // Horizontal lines
    for (let y = 0; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    ctx.stroke();
    ctx.restore();
  }
}