export type RefDes = string;
export type PinNumber = string;
export type NetlistPinId = string;

export interface LogicalComponent {
  refdes: RefDes;
  properties: Record<string, string>;
  spiceData: {
    engine: string;
    target: string;
    pins: PinNumber[];
  };
  pinMap: Map<PinNumber, NetlistPinId>;
}

export class ComponentStore {
  private components = new Map<RefDes, LogicalComponent>();

  addComponent(refdes: RefDes, spiceData: LogicalComponent['spiceData'], pins: Map<PinNumber, NetlistPinId>): void {
    if (this.components.has(refdes)) {
      throw new Error(`Component with refdes ${refdes} already exists`);
    }

    this.components.set(refdes, {
      refdes,
      properties: {},
      spiceData,
      pinMap: pins,
    });
  }

  removeComponent(refdes: RefDes): void {
    this.components.delete(refdes);
  }

  updateRefdes(oldRefdes: RefDes, newRefdes: RefDes): void {
    const component = this.components.get(oldRefdes);
    if (!component) {
      throw new Error(`Component ${oldRefdes} not found`);
    }
    if (this.components.has(newRefdes)) {
      throw new Error(`Component ${newRefdes} already exists`);
    }

    component.refdes = newRefdes;
    this.components.set(newRefdes, component);
    this.components.delete(oldRefdes);
  }

  setProperty(refdes: RefDes, key: string, value: string): void {
    const component = this.components.get(refdes);
    if (!component) {
      throw new Error(`Component ${refdes} not found`);
    }
    component.properties[key] = value;
  }

  getComponent(refdes: RefDes): LogicalComponent | undefined {
    return this.components.get(refdes);
  }

  getAllComponents(): LogicalComponent[] {
    return Array.from(this.components.values());
  }

  getPinId(refdes: RefDes, pinNumber: PinNumber): NetlistPinId | undefined {
    return this.components.get(refdes)?.pinMap.get(pinNumber);
  }
}