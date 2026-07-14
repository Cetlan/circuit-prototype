import type { ComponentInstance, Wire, WorldPin, ToolId, ToolInterface } from '../types/schematic.ts';
import { SpatialIndex } from './spatialIndex.ts';

export interface SchematicState {
  components: ComponentInstance[];
  wires: Wire[];
  selectedComponentIds: Set<string>;
  selectedLabels: Set<string>;
  pendingWire: {
    startPin: WorldPin,
    viaPoints: { x: number, y: number }[],
    currentPos: { x: number, y: number }
  } | null;
  mousePos: { x: number, y: number };
  activeToolId: ToolId;
  spatialIndex: SpatialIndex;
}

export const state: SchematicState = {
  components: [],
  wires: [],
  selectedComponentIds: new Set(),
  selectedLabels: new Set(),
  pendingWire: null,
  mousePos: { x: 0, y: 0 },
  activeToolId: 'selection',
  spatialIndex: new SpatialIndex(),
};