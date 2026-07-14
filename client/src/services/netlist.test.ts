import { describe, it, expect, beforeEach } from 'vitest';
import { Netlist } from './netlist';

describe('Netlist', () => {
  let netlist: Netlist;

  beforeEach(() => {
    netlist = new Netlist();
  });

  it('should create a net with an optional name', () => {
    const netId = netlist.createNet('VCC');
    expect(netlist.getNetName(netId)).toBe('VCC');

    const anonymousNetId = netlist.createNet();
    expect(netlist.getNetName(anonymousNetId)).toBe('1');
  });

  it('should assign a pin to a net and maintain bidirectional mapping', () => {
    const netId = netlist.createNet('Net1');
    const pinId = 'pin1';

    netlist.assignPinToNet(pinId, netId);

    expect(netlist.getNetForPin(pinId)).toBe(netId);
    expect(netlist.getPinsForNet(netId)).toContain(pinId);
  });

  it('should disconnect a pin from its net', () => {
    const netId = netlist.createNet('Net1');
    const pinId = 'pin1';

    netlist.assignPinToNet(pinId, netId);
    netlist.disconnectPin(pinId);

    expect(netlist.getNetForPin(pinId)).toBeUndefined();
    expect(netlist.getPinsForNet(netId)).not.toContain(pinId);
  });

  it('should merge nets when connecting pins from different nets', () => {
    const net1 = netlist.createNet('Net1');
    const net2 = netlist.createNet('Net2');
    const pin1 = 'pin1';
    const pin2 = 'pin2';

    netlist.assignPinToNet(pin1, net1);
    netlist.assignPinToNet(pin2, net2);

    const resultingNetId = netlist.connectPins(pin1, pin2);

    expect(resultingNetId).toBe(net1);
    expect(netlist.getNetForPin(pin1)).toBe(net1);
    expect(netlist.getNetForPin(pin2)).toBe(net1);
    expect(netlist.getPinsForNet(net1)).toContain(pin1);
    expect(netlist.getPinsForNet(net1)).toContain(pin2);

    // Net 2 should be gone
    expect(netlist.getPinsForNet(net2)).toEqual([]);
    expect(netlist.getNetName(net2)).toBeUndefined();
  });

  it('should create a new net when connecting two unconnected pins', () => {
    const pin1 = 'pin1';
    const pin2 = 'pin2';

    const netId = netlist.connectPins(pin1, pin2);

    expect(netId).toBeDefined();
    expect(netlist.getNetForPin(pin1)).toBe(netId);
    expect(netlist.getNetForPin(pin2)).toBe(netId);
  });

  it('should handle connecting a pin to an existing net', () => {
    const netId = netlist.createNet('Net1');
    const pin1 = 'pin1';
    const pin2 = 'pin2';

    netlist.assignPinToNet(pin1, netId);
    const resultNetId = netlist.connectPins(pin1, pin2);

    expect(resultNetId).toBe(netId);
    expect(netlist.getNetForPin(pin2)).toBe(netId);
  });

  it('should allow empty nets', () => {
    const netId = netlist.createNet('EmptyNet');
    expect(netlist.getPinsForNet(netId)).toEqual([]);
  });

  it('should disconnect all pins when a net is deleted', () => {
    const netId = netlist.createNet('Net1');
    const pin1 = 'pin1';
    const pin2 = 'pin2';

    netlist.assignPinToNet(pin1, netId);
    netlist.assignPinToNet(pin2, netId);

    netlist.deleteNet(netId);

    expect(netlist.getNetForPin(pin1)).toBeUndefined();
    expect(netlist.getNetForPin(pin2)).toBeUndefined();
    expect(netlist.getPinsForNet(netId)).toEqual([]);
  });

  it('should throw error when assigning pin to non-existent net', () => {
    expect(() => netlist.assignPinToNet('pin1', 'non-existent')).toThrow('Net non-existent does not exist');
  });

  it('should throw error when setting name for non-existent net', () => {
    expect(() => netlist.setNetName('non-existent', 'NewName')).toThrow('Net non-existent does not exist');
  });

  it('should automatically increment names for anonymous nets', () => {
    const net1 = netlist.createNet();
    const net2 = netlist.createNet();
    const net3 = netlist.createNet();

    expect(netlist.getNetName(net1)).toBe('1');
    expect(netlist.getNetName(net2)).toBe('2');
    expect(netlist.getNetName(net3)).toBe('3');
  });

  it('should prioritize net1 name during merge if net1 is unnamed', () => {
    const net1 = netlist.createNet(); // unnamed
    const net2 = netlist.createNet('Net2');
    const pin1 = 'pin1';
    const pin2 = 'pin2';

    netlist.assignPinToNet(pin1, net1);
    netlist.assignPinToNet(pin2, net2);

    netlist.connectPins(pin1, pin2);

    expect(netlist.getNetName(net1)).toBe('Net2');
  });
});