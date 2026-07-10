import type { WorldPin } from '../types/schematic.ts';

export class SpatialIndex {
  private cellSize = 50;
  private grid = new Map<string, Set<WorldPin>>();

  private getCellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  clear() {
    this.grid.clear();
  }

  addPin(pin: WorldPin) {
    const key = this.getCellKey(pin.x, pin.y);
    if (!this.grid.has(key)) this.grid.set(key, new Set());
    this.grid.get(key)!.add(pin);
  }

  getNearbyPins(x: number, y: number): WorldPin[] {
    const pins: WorldPin[] = [];
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${col + i},${row + j}`;
        const cell = this.grid.get(key);
        if (cell) pins.push(...cell);
      }
    }
    return pins;
  }
}