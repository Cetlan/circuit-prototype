import { describe, it, expect, beforeEach } from 'vitest';
import { Netlist } from './netlist';
import { ComponentStore } from './componentStore';
import { CircuitManager } from './circuitManager';

describe('Circuit Logic System', () => {
  let netlist: Netlist;
  let componentStore: ComponentStore;
  let circuitManager: CircuitManager;

  beforeEach(() => {
    netlist = new Netlist();
    componentStore = new ComponentStore();
    circuitManager = new CircuitManager(netlist, componentStore);
  });

  describe('ComponentStore', () => {
    it('should add and retrieve a component', () => {
      const spiceData = { engine: 'spice', target: 'default', pins: ['1', '2'] };
      const pins = new Map([['1', 'pin1'], ['2', 'pin2']]);
      componentStore.addComponent('R1', spiceData, pins);

      const comp = componentStore.getComponent('R1');
      expect(comp).toBeDefined();
      expect(comp?.refdes).toBe('R1');
    });

    it('should update refdes and maintain data', () => {
      const spiceData = { engine: 'spice', target: 'default', pins: ['1', '2'] };
      const pins = new Map([['1', 'pin1'], ['2', 'pin2']]);
      componentStore.addComponent('R1', spiceData, pins);

      componentStore.updateRefdes('R1', 'R2');
      expect(componentStore.getComponent('R1')).toBeUndefined();
      expect(componentStore.getComponent('R2')).toBeDefined();
      expect(componentStore.getComponent('R2')?.refdes).toBe('R2');
    });

    it('should set and get properties', () => {
      const spiceData = { engine: 'spice', target: 'default', pins: ['1', '2'] };
      const pins = new Map([['1', 'pin1'], ['2', 'pin2']]);
      componentStore.addComponent('R1', spiceData, pins);

      componentStore.setProperty('R1', 'resistance', '1k');
      expect(componentStore.getComponent('R1')?.properties.resistance).toBe('1k');
    });

    it('should throw when adding duplicate refdes', () => {
      const spiceData = { engine: 'spice', target: 'default', pins: ['1'] };
      const pins = new Map([['1', 'p1']]);
      componentStore.addComponent('R1', spiceData, pins);
      expect(() => componentStore.addComponent('R1', spiceData, pins)).toThrow();
    });
  });

  describe('CircuitManager', () => {
    const resSpice = { engine: 'spice', target: 'default', pins: ['1', '2'] };
    const capSpice = { engine: 'spice', target: 'default', pins: ['1', '2'] };

    it('should add components and initialize pins', () => {
      circuitManager.addComponent('R1', resSpice, ['1', '2']);
      const comp = circuitManager.getComponent('R1');
      expect(comp).toBeDefined();
      expect(comp?.pinMap.size).toBe(2);
      expect(comp?.pinMap.get('1')).toBeDefined();
      expect(comp?.pinMap.get('2')).toBeDefined();
    });

    it('should connect pins across components', () => {
      circuitManager.addComponent('R1', resSpice, ['1', '2']);
      circuitManager.addComponent('C1', capSpice, ['1', '2']);

      const netId = circuitManager.connectComponentPins('R1', '1', 'C1', '2');
      expect(netId).toBeDefined();

      expect(circuitManager.getNetForPin('R1', '1')).toBe(netId);
      expect(circuitManager.getNetForPin('C1', '2')).toBe(netId);
    });

    it('should remove components and clean up netlist', () => {
      circuitManager.addComponent('R1', resSpice, ['1', '2']);
      circuitManager.addComponent('C1', capSpice, ['1', '2']);
      circuitManager.connectComponentPins('R1', '1', 'C1', '2');

      const pinId = componentStore.getPinId('R1', '1')!;
      const netId = netlist.getNetForPin(pinId);
      expect(netId).toBeDefined();

      circuitManager.removeComponent('R1');
      expect(circuitManager.getComponent('R1')).toBeUndefined();
      expect(netlist.getNetForPin(pinId)).toBeUndefined();
    });

    it('should handle refdes updates in manager', () => {
      circuitManager.addComponent('R1', resSpice, ['1', '2']);
      circuitManager.updateRefdes('R1', 'R_NEW');

      expect(circuitManager.getComponent('R1')).toBeUndefined();
      expect(circuitManager.getComponent('R_NEW')).toBeDefined();

      // Check that we can still use its pins
      const pinId = componentStore.getPinId('R_NEW', '1');
      expect(pinId).toBeDefined();
    });

    it('should throw when updating to a duplicate refdes', () => {
      circuitManager.addComponent('R1', resSpice, ['1', '2']);
      circuitManager.addComponent('R2', resSpice, ['1', '2']);
      expect(() => circuitManager.updateRefdes('R1', 'R2')).toThrow();
    });

    it('should throw error when connecting non-existent pins', () => {
      circuitManager.addComponent('R1', resSpice, ['1', '2']);
      expect(() => circuitManager.connectComponentPins('R1', '99', 'R1', '1')).toThrow();
    });
  });
});