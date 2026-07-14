export type PinId = string;
export type NetId = string;

export interface Net {
  name?: string;
}

export class Netlist {
  private netCounter = 1;
  private pinToNet = new Map<PinId, NetId>();
  private netToPins = new Map<NetId, Set<PinId>>();
  private nets = new Map<NetId, Net>();

  /**
   * Creates a new net, optionally with a name.
   */
  createNet(name?: string): NetId {
    const netId = crypto.randomUUID();
    const finalName = name ?? (this.netCounter++).toString();
    this.netToPins.set(netId, new Set());
    this.nets.set(netId, { name: finalName });
    return netId;
  }

  /**
   * Associates a pin with a specific net. 
   * If the pin was previously associated with another net, it's disconnected from it first.
   */
  assignPinToNet(pinId: PinId, netId: NetId): void {
    if (!this.nets.has(netId)) {
      throw new Error(`Net ${netId} does not exist`);
    }

    this.disconnectPin(pinId);

    this.pinToNet.set(pinId, netId);
    this.netToPins.get(netId)!.add(pinId);
  }

  /**
   * Removes a pin from its current net, if any.
   */
  disconnectPin(pinId: PinId): void {
    const netId = this.pinToNet.get(pinId);
    if (netId) {
      const pins = this.netToPins.get(netId);
      if (pins) {
        pins.delete(pinId);
      }
      this.pinToNet.delete(pinId);
    }
  }

  /**
   * Connects two pins together.
   * If both pins are already on nets, the nets are merged.
   * If neither is on a net, a new empty net is created.
   */
  connectPins(pinId1: PinId, pinId2: PinId): NetId {
    const net1 = this.getNetForPin(pinId1);
    const net2 = this.getNetForPin(pinId2);

    if (net1 && net2) {
      if (net1 === net2) return net1;
      this.mergeNets(net1, net2);
      return net1;
    }

    if (net1) {
      this.assignPinToNet(pinId2, net1);
      return net1;
    }

    if (net2) {
      this.assignPinToNet(pinId1, net2);
      return net2;
    }

    const newNet = this.createNet();
    this.assignPinToNet(pinId1, newNet);
    this.assignPinToNet(pinId2, newNet);
    return newNet;
  }

  /**
   * Merges net2 into net1.
   */
  private mergeNets(net1: NetId, net2: NetId): void {
    const pins2 = this.netToPins.get(net2);
    if (pins2) {
      for (const pinId of pins2) {
        this.assignPinToNet(pinId, net1);
      }
    }

    const netObj1 = this.nets.get(net1);
    const netObj2 = this.nets.get(net2);

    if (netObj1 && netObj2 && netObj2.name && (!netObj1.name || this.isGeneratedName(netObj1.name))) {
      netObj1.name = netObj2.name;
    }

    this.netToPins.delete(net2);
    this.nets.delete(net2);
  }

  private isGeneratedName(name?: string): boolean {
    return name !== undefined && /^\d+$/.test(name);
  }

  /**
   * Deletes a net. All pins associated with this net become unconnected.
   */
  deleteNet(netId: NetId): void {
    const pins = this.netToPins.get(netId);
    if (pins) {
      for (const pinId of pins) {
        this.pinToNet.delete(pinId);
      }
    }
    this.netToPins.delete(netId);
    this.nets.delete(netId);
  }

  getNetForPin(pinId: PinId): NetId | undefined {
    return this.pinToNet.get(pinId);
  }

  getPinsForNet(netId: NetId): PinId[] {
    const pins = this.netToPins.get(netId);
    return pins ? Array.from(pins) : [];
  }

  getNetName(netId: NetId): string | undefined {
    return this.nets.get(netId)?.name;
  }

  setNetName(netId: NetId, name: string): void {
    const net = this.nets.get(netId);
    if (!net) {
      throw new Error(`Net ${netId} does not exist`);
    }
    net.name = name;
  }

  getNet(netId: NetId): Net | undefined {
    return this.nets.get(netId);
  }
}