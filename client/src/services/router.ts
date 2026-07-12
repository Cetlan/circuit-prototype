import type { WorldPin, WireSegment } from '../types/schematic.ts';

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  parent: Node | null;
  direction: 'H' | 'V' | null;
}

export class Router {
  private gridSize = 10;

  private snap(val: number) {
    return Math.round(val / this.gridSize) * this.gridSize;
  }

  route(startPin: WorldPin, endPin: WorldPin, costMap: Record<string, number>): WireSegment[] {
    const startNodePos = { x: this.snap(startPin.x), y: this.snap(startPin.y) };
    const endNodePos = { x: this.snap(endPin.x), y: this.snap(endPin.y) };

    const pathNodes = this.findPath(startNodePos, endNodePos, costMap, endPin);
    if (!pathNodes) return [];

    return this.constructSegments(startPin, endPin, pathNodes);
  }

  private findPath(startPos: { x: number, y: number }, endPos: { x: number, y: number }, costMap: Record<string, number>, targetPin: WorldPin): Node[] | null {
    const openSet: Node[] = [];
    const closedSet = new Set<string>();

    const startNode: Node = { x: startPos.x, y: startPos.y, g: 0, h: 0, parent: null, direction: null };
    openSet.push(startNode);

    while (openSet.length > 0) {
      openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));
      const current = openSet.shift()!;

      if (current.x === endPos.x && current.y === endPos.y) {
        return this.reconstructPath(current);
      }

      closedSet.add(`${current.x},${current.y}`);

      const neighbors = [
        { x: current.x + this.gridSize, y: current.y, dir: 'H' },
        { x: current.x - this.gridSize, y: current.y, dir: 'H' },
        { x: current.x, y: current.y + this.gridSize, dir: 'V' },
        { x: current.x, y: current.y - this.gridSize, dir: 'V' },
      ];

      for (const nPos of neighbors) {
        if (closedSet.has(`${nPos.x},${nPos.y}`)) continue;

        const stepCost = (nPos.x === targetPin.x && nPos.y === targetPin.y)
          ? 1
          : (costMap[`${nPos.x},${nPos.y}`] ?? 1);

        const bendCost = (current.direction && current.direction !== nPos.dir) ? 20 : 0;
        const totalG = current.g + stepCost + bendCost;

        const existing = openSet.find(node => node.x === nPos.x && node.y === nPos.y);
        if (!existing || totalG < existing.g) {
          if (!existing) {
            openSet.push({
              x: nPos.x, y: nPos.y, g: totalG,
              h: Math.abs(nPos.x - endPos.x) + Math.abs(nPos.y - endPos.y),
              parent: current, direction: nPos.dir as 'H' | 'V'
            });
          } else {
            existing.g = totalG;
            existing.parent = current;
            existing.direction = nPos.dir as 'H' | 'V';
          }
        }
      }
    }
    return null;
  }

  private reconstructPath(node: Node): Node[] {
    const path: Node[] = [];
    let curr: Node | null = node;
    while (curr) {
      path.unshift(curr);
      curr = curr.parent;
    }
    return path;
  }

  private constructSegments(startPin: WorldPin, endPin: WorldPin, pathNodes: Node[]): WireSegment[] {
    const segments: WireSegment[] = [];
    segments.push({ id: crypto.randomUUID(), x1: startPin.x, y1: startPin.y, x2: pathNodes[0].x, y2: pathNodes[0].y });
    for (let i = 0; i < pathNodes.length - 1; i++) {
      segments.push({ id: crypto.randomUUID(), x1: pathNodes[i].x, y1: pathNodes[i].y, x2: pathNodes[i + 1].x, y2: pathNodes[i + 1].y });
    }
    segments.push({ id: crypto.randomUUID(), x1: pathNodes[pathNodes.length - 1].x, y1: pathNodes[pathNodes.length - 1].y, x2: endPin.x, y2: endPin.y });
    return segments;
  }
}

export const router = new Router();