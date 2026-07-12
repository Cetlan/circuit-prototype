export type PropertyDescriptor =
  | { type: 'string'; label: string; default: string; visible?: boolean }
  | { type: 'select'; label: string; options: string[]; default: string; visible?: boolean }
  | { type: 'boolean'; label: string; default: boolean; visible?: boolean };


type InlineSymbol = { data: string }
type RemoteSymbol = { url: string }

export type SymbolSource = InlineSymbol | RemoteSymbol

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

type StandardId = string;

export interface ComponentDescriptor {
  id: string;
  name: string;
  prefix: string;
  symbol: Record<StandardId, SymbolSource>;
  properties: Record<string, PropertyDescriptor>;
  simulation?: SimulationTarget[];
}

export function isInlineSymbol(symbolSource: SymbolSource): symbolSource is InlineSymbol {
  return "data" in symbolSource
}