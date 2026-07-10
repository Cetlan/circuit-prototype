export type ToolId = 'selection' | 'component' | 'wire';

export interface Pin {
  number: string;
  x: number;
  y: number;
}

export interface ComponentDefinition {
  id: string;
  img: HTMLImageElement;
  pins: Pin[];
  width: number;
  height: number;
}

export interface ComponentInstance {
  id: string;
  x: number;
  y: number;
  definition: ComponentDefinition;
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

export interface ToolInterface {
  id: ToolId;
  onMouseDown?: (e: MouseEvent, worldPos: { x: number, y: number }) => void;
  onMouseMove?: (e: MouseEvent, worldPos: { x: number, y: number }) => void;
  onMouseUp?: (e: MouseEvent, worldPos: { x: number, y: number }) => void;
  onClick?: (e: MouseEvent, worldPos: { x: number, y: number }) => void;
  onDraw?: (ctx: CanvasRenderingContext2D) => void;
}