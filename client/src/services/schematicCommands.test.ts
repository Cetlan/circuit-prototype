import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MoveComponentCommand,
  RotateComponentCommand,
  AddWireCommand,
  DeleteWireCommand,
  DeleteComponentCommand,
  UpdateLabelCommand,
  AddComponentCommand
} from './schematicCommands';
import { orchestrator } from './schematicOrchestrator';
import { store } from '../store/schematicStore';
import { circuitManager } from './circuitManager';
import type { ComponentDefinition } from '../types/schematic';

vi.mock('./schematicOrchestrator', () => ({
  orchestrator: {
    moveComponent: vi.fn(),
    rotateComponent: vi.fn(),
    createWire: vi.fn(),
    deleteWire: vi.fn(),
    deleteComponent: vi.fn(),
    updateLabelOffset: vi.fn(),
    addComponentFromDefinition: vi.fn(),
    notify: vi.fn(),
  },
}));

vi.mock('../store/schematicStore', () => ({
  store: {
    components: [],
    wires: [],
  },
}));

vi.mock('./circuitManager', () => ({
  circuitManager: {
    connectComponentPins: vi.fn(),
  },
}));

describe('SchematicCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.components = [];
    store.wires = [];
  });

  describe('MoveComponentCommand', () => {
    it('should execute move and undo with negative offset', () => {
      const ids = ['comp1', 'comp2'];
      const cmd = new MoveComponentCommand(ids, 10, 20);

      cmd.execute();
      expect(orchestrator.moveComponent).toHaveBeenCalledWith('comp1', 10, 20);
      expect(orchestrator.moveComponent).toHaveBeenCalledWith('comp2', 10, 20);

      cmd.undo();
      expect(orchestrator.moveComponent).toHaveBeenCalledWith('comp1', -10, -20);
      expect(orchestrator.moveComponent).toHaveBeenCalledWith('comp2', -10, -20);
    });
  });

  describe('RotateComponentCommand', () => {
    it('should execute rotation and undo by rotating 3 more times', () => {
      const ids = ['comp1'];
      const cmd = new RotateComponentCommand(ids);

      cmd.execute();
      expect(orchestrator.rotateComponent).toHaveBeenCalledWith('comp1');

      cmd.undo();
      const calls = vi.mocked(orchestrator.rotateComponent).mock.calls.filter(call => call[0] === 'comp1');
      expect(calls).toHaveLength(4); // 1 (execute) + 3 (undo)
    });
  });

  describe('AddWireCommand', () => {
    it('should execute wire creation and undo by deleting the wire', () => {
      const startPin = { componentId: 'c1', pinNumber: '1', x: 0, y: 0 };
      const endPin = { componentId: 'c2', pinNumber: '1', x: 10, y: 0 };
      const cmd = new AddWireCommand(startPin, endPin);

      cmd.execute();
      expect(orchestrator.createWire).toHaveBeenCalledWith(startPin, endPin, undefined);

      // Mock the wire being added to store
      const wireId = 'wire-123';
      store.wires = [{ id: wireId, startPin, endPin, segments: [] }];

      cmd.undo();
      expect(orchestrator.deleteWire).toHaveBeenCalledWith(wireId);
    });
  });

  describe('DeleteWireCommand', () => {
    it('should execute wire deletion and undo by restoring wire and connectivity', () => {
      const wire = {
        id: 'w1',
        startPin: { componentId: 'c1', pinNumber: '1', x: 0, y: 0 },
        endPin: { componentId: 'c2', pinNumber: '1', x: 10, y: 0 },
        segments: []
      };
      store.wires = [wire];

      const cmd = new DeleteWireCommand('w1');
      cmd.execute();
      expect(orchestrator.deleteWire).toHaveBeenCalledWith('w1');

      cmd.undo();
      expect(store.wires).toContain(wire);

      store.components = [
        { id: 'c1', refdes: 'R1' } as any,
        { id: 'c2', refdes: 'R2' } as any,
      ];

      // Re-run undo to test connectivity restoration (since we just updated store.components)
      cmd.undo();
      expect(circuitManager.connectComponentPins).toHaveBeenCalledWith('R1', '1', 'R2', '1');
      expect(orchestrator.notify).toHaveBeenCalled();
    });
  });

  describe('DeleteComponentCommand', () => {
    it('should execute component deletion and undo by restoring component and wires', () => {
      const comp = { id: 'c1', refdes: 'R1' } as any;
      const wire = {
        id: 'w1',
        startPin: { componentId: 'c1', pinNumber: '1', x: 0, y: 0 },
        endPin: { componentId: 'c2', pinNumber: '1', x: 10, y: 0 },
        segments: []
      };
      store.components = [comp];
      store.wires = [wire];

      const cmd = new DeleteComponentCommand('c1');
      cmd.execute();
      expect(orchestrator.deleteComponent).toHaveBeenCalledWith('c1');

      cmd.undo();
      expect(store.components).toContain(comp);
      expect(store.wires).toContain(wire);

      store.components.push({ id: 'c2', refdes: 'R2' } as any);
      cmd.undo();
      expect(circuitManager.connectComponentPins).toHaveBeenCalledWith('R1', '1', 'R2', '1');
      expect(orchestrator.notify).toHaveBeenCalled();
    });
  });

  describe('UpdateLabelCommand', () => {
    it('should execute offset and undo with negative offset', () => {
      const cmd = new UpdateLabelCommand('c1', 'value', 5, -5);

      cmd.execute();
      expect(orchestrator.updateLabelOffset).toHaveBeenCalledWith('c1', 'value', 5, -5);

      cmd.undo();
      expect(orchestrator.updateLabelOffset).toHaveBeenCalledWith('c1', 'value', -5, 5);
    });
  });

  describe('AddComponentCommand', () => {
    it('should execute async addition and undo by deleting the component', async () => {
      const def = { id: 'res' } as ComponentDefinition;
      const instance = { id: 'inst-123' } as any;
      vi.mocked(orchestrator.addComponentFromDefinition).mockResolvedValue(instance);

      const cmd = new AddComponentCommand(def, 0, 0);
      await cmd.execute();

      expect(orchestrator.addComponentFromDefinition).toHaveBeenCalledWith(def, 0, 0, 0);

      cmd.undo();
      expect(orchestrator.deleteComponent).toHaveBeenCalledWith('inst-123');
    });
  });
});