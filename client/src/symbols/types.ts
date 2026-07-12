export type PropertyDescriptor =
  | { type: 'string'; label: string; default: string; visible?: boolean }
  | { type: 'select'; label: string; options: string[]; default: string; visible?: boolean }
  | { type: 'boolean'; label: string; default: boolean; visible?: boolean };

export type ComponentSymbol =
  | { source: 'inline'; data: string }
  | { source: 'remote'; url: string };

export interface SimulationTarget {
  engine: string;
  target: string;
  paramFormat?: string;
  modelDefinition?: string;
  /** 
   * The strict positional sequence of SVG pin names required 
   * by this specific mathematical model's netlist entry.
   */
  pins: string[];
}

export interface ComponentDescriptor {
  id: string;
  name: string;
  prefix: string;
  symbol: ComponentSymbol;
  properties: Record<string, PropertyDescriptor>;
  simulation?: SimulationTarget[];
}