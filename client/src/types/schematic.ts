export type ToolId = 'selection' | 'component' | 'wire';

export interface Pin {
  number: string;
  x: number;
  y: number;
}

import type { ComponentDescriptor } from '../symbols/types';
export type { ComponentDescriptor };

export interface ComponentDefinition extends ComponentDescriptor {
  img: HTMLImageElement;
  pins: Pin[];
  width: number;
  height: number;
}

export interface ComponentInstance {
  id: string;
  x: number;
  y: number;
  rotation: number;
  definition: ComponentDefinition;
  refdes: string;
  value: string;
  refdesOffset?: { x: number, y: number };
  valueOffset?: { x: number, y: number };
}

export interface WorldPin {
  componentId: string;
  pinNumber: string;
  x: number;
  y: number;
}

export interface WireSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Wire {
  id: string;
  startPin: WorldPin;
  endPin: WorldPin;
  segments: WireSegment[];
}

export type ToolResult =
  | { status: 'none' }
  | { status: 'completed' }
  | { status: 'pinClicked'; pin: WorldPin };

export interface ToolInterface {
  id: ToolId;
  onMouseDown?: (e: MouseEvent, worldPos: { x: number, y: number }) => ToolResult | void;
  onMouseMove?: (e: MouseEvent, worldPos: { x: number, y: number }) => ToolResult | void;
  onMouseUp?: (e: MouseEvent, worldPos: { x: number, y: number }) => ToolResult | void;
  onClick?: (e: MouseEvent, worldPos: { x: number, y: number }) => ToolResult | void;
  onDraw?: (ctx: CanvasRenderingContext2D) => void;
}