import type { ComponentInstance, Pin } from '../types/schematic.ts';

export const GeometryService = {
  getCurrentDimensions(comp: ComponentInstance): { width: number, height: number } {
    const { width, height } = comp.definition;
    return comp.rotation % 180 === 0 ? { width, height } : { width: height, height: width };
  },

  getComponentCenter(comp: ComponentInstance): { x: number, y: number } {
    const { width, height } = this.getCurrentDimensions(comp);
    return { x: comp.x + width / 2, y: comp.y + height / 2 };
  },

  getPinWorldPos(comp: ComponentInstance, pin: Pin): { x: number, y: number } {
    const center = this.getComponentCenter(comp);
    const localX = pin.x - comp.definition.width / 2;
    const localY = pin.y - comp.definition.height / 2;

    let rotatedX = localX;
    let rotatedY = localY;

    const angle = comp.rotation % 360;
    if (angle === 90) {
      rotatedX = -localY;
      rotatedY = localX;
    } else if (angle === 180) {
      rotatedX = -localX;
      rotatedY = -localY;
    } else if (angle === 270) {
      rotatedX = localY;
      rotatedY = -localX;
    }

    return { x: center.x + rotatedX, y: center.y + rotatedY };
  },

  snap(value: number, gridSize: number = 10): number {
    return Math.round(value / gridSize) * gridSize;
  }
};