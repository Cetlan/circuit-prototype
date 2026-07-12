import type { ComponentInstance } from '../types/schematic.ts';

export interface LabelPosition {
  x: number;
  y: number;
  textAlign: 'left' | 'center' | 'right';
}

export interface LabelPlacementStrategy {
  calculateRefdesPosition(comp: ComponentInstance, centerX: number, centerY: number): LabelPosition;
  calculateValuePosition(comp: ComponentInstance, centerX: number, centerY: number): LabelPosition;
  rotateOffset(offset: { x: number, y: number }): { x: number, y: number };
}

export class DefaultLabelPlacementStrategy implements LabelPlacementStrategy {
  private readonly padding = 20;
  private readonly fontOffset = 15; // half font height for vertical centering

  calculateRefdesPosition(comp: ComponentInstance, centerX: number, centerY: number): LabelPosition {
    const { width: w, height: h } = comp.definition;
    const isHorizontal = comp.rotation % 180 === 0;
    const halfW = (isHorizontal ? w : h) / 2;
    const halfH = (isHorizontal ? h : w) / 2;

    if (isHorizontal) {
      return {
        x: centerX + (comp.refdesOffset?.x || 0),
        y: centerY - halfH - this.padding - this.fontOffset + (comp.refdesOffset?.y || 0),
        textAlign: 'center',
      };
    } else {
      return {
        x: centerX - halfW - this.padding + (comp.refdesOffset?.x || 0),
        y: centerY + (comp.refdesOffset?.y || 0),
        textAlign: 'right',
      };
    }
  }

  calculateValuePosition(comp: ComponentInstance, centerX: number, centerY: number): LabelPosition {
    const { width: w, height: h } = comp.definition;
    const isHorizontal = comp.rotation % 180 === 0;
    const halfW = (isHorizontal ? w : h) / 2;
    const halfH = (isHorizontal ? h : w) / 2;

    if (isHorizontal) {
      return {
        x: centerX + (comp.valueOffset?.x || 0),
        y: centerY + halfH + this.padding + this.fontOffset + (comp.valueOffset?.y || 0),
        textAlign: 'center',
      };
    } else {
      return {
        x: centerX + halfW + this.padding + (comp.valueOffset?.x || 0),
        y: centerY + (comp.valueOffset?.y || 0),
        textAlign: 'left',
      };
    }
  }

  rotateOffset(offset: { x: number, y: number }): { x: number, y: number } {
    return { x: -offset.y, y: offset.x };
  }
}

export const defaultLabelPlacementStrategy = new DefaultLabelPlacementStrategy();