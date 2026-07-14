import { Netlist } from './netlist';
import { ComponentStore, RefDes, PinNumber, NetlistPinId, LogicalComponent } from './componentStore';

export class CircuitManager {
  constructor(
    private netlist: Netlist,
    private componentStore: ComponentStore
  ) { }

  private nextPinId(): NetlistPinId {
    return crypto.randomUUID();
  }

  /**
   * Adds a logical component to the circuit and initializes its pins in the netlist.
   */
  addComponent(
    refdes: RefDes,
    spiceData: LogicalComponent['spiceData'],
    pins: PinNumber[],
    initialProperties: Record<string, string> = {}
  ) {
    const pinMap = new Map<PinNumber, NetlistPinId>();
    pins.forEach(pin => {
      pinMap.set(pin, this.nextPinId());
    });

    this.componentStore.addComponent(refdes, spiceData, pinMap, initialProperties);
  }

  /**
   * Removes a component and cleans up all its associated pins from the netlist.
   */
  removeComponent(refdes: RefDes): void {
    const component = this.componentStore.getComponent(refdes);
    if (component) {
      for (const pinId of component.pinMap.values()) {
        this.netlist.disconnectPin(pinId);
      }
    }
    this.componentStore.removeComponent(refdes);
  }

  /**
   * Connects two component pins together.
   */
  connectComponentPins(
    refdes1: RefDes, pinNum1: PinNumber,
    refdes2: RefDes, pinNum2: PinNumber
  ): string {
    const pinId1 = this.componentStore.getPinId(refdes1, pinNum1);
    const pinId2 = this.componentStore.getPinId(refdes2, pinNum2);

    if (!pinId1) throw new Error(`Pin ${pinNum1} not found on component ${refdes1}`);
    if (!pinId2) throw new Error(`Pin ${pinNum2} not found on component ${refdes2}`);

    return this.netlist.connectPins(pinId1, pinId2);
  }

  /**
   * Disconnects a specific pin of a component from its net.
   */
  disconnectComponentPin(refdes: RefDes, pinNum: PinNumber): void {
    const pinId = this.componentStore.getPinId(refdes, pinNum);
    if (!pinId) throw new Error(`Pin ${pinNum} not found on component ${refdes}`);
    this.netlist.disconnectPin(pinId);
  }

  updateRefdes(oldRefdes: RefDes, newRefdes: RefDes): void {
    this.componentStore.updateRefdes(oldRefdes, newRefdes);
  }

  setProperty(refdes: RefDes, key: string, value: string): void {
    this.componentStore.setProperty(refdes, key, value);
  }

  getNetForPin(refdes: RefDes, pinNum: PinNumber): string | undefined {
    const pinId = this.componentStore.getPinId(refdes, pinNum);
    if (!pinId) return undefined;
    return this.netlist.getNetForPin(pinId);
  }

  getComponent(refdes: RefDes) {
    return this.componentStore.getComponent(refdes);
  }

  /**
   * Generates a SPICE netlist from the current circuit state.
   */
  generateSpiceNetlist(): string {
    const components = this.componentStore.getAllComponents();
    const lines: string[] = [];

    for (const component of components) {
      const { refdes, spiceData, pinMap, properties } = component;
      const netNames: string[] = [];

      for (const pinNum of spiceData.pins) {
        const pinId = pinMap.get(pinNum);
        let netName: string | undefined = undefined;

        if (pinId) {
          const netId = this.netlist.getNetForPin(pinId);
          if (netId) {
            netName = this.netlist.getNetName(netId);
          }
        }

        // If the pin is not connected to a named net, 
        // assign it a unique floating net name to avoid accidental connections.
        if (!netName) {
          netName = `FLOAT_${refdes}_${pinNum}`;
        }

        netNames.push(netName);
      }

      const value = properties['value'] || '0';
      const line = `${refdes} ${netNames.join(' ')} ${value}`;
      lines.push(line);
    }

    return lines.join('\n');
  }
}

export const circuitManager = new CircuitManager(new Netlist(), new ComponentStore());