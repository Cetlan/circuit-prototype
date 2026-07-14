import { describe, it, expect, beforeEach, vi } from 'vitest';
import { orchestrator } from './schematicOrchestrator';
import { store } from '../store/schematicStore';
import { circuitManager } from './circuitManager';
import type { ComponentDefinition, WorldPin } from '../types/schematic';

vi.mock('../store/schematicStore', () => ({
  store: {
    notify: vi.fn(),
    onLibraryUpdate: vi.fn(),
    setTool: vi.fn(),
    setSelected: vi.fn(),
    toggleSelection: vi.fn(),
    clearSelection: vi.fn(),
    setLabelSelected: vi.fn(),
    toggleLabelSelection: vi.fn(),
    updateLabelOffset: vi.fn(),
    addComponent: vi.fn(),
    createWire: vi.fn(),
    updateSpatialIndex: vi.fn(),
    updateWirePositions: vi.fn(),
    snap: vi.fn((v) => v),
    moveSelected: vi.fn(),
    rotateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    library: {
      fetchComponent: vi.fn(),
    },
    components: [],
    wires: [],
    selectedComponentIds: new Set<string>(),
    selectedLabels: new Set<string>(),
    pendingWire: null,
    mousePos: { x: 0, y: 0 },
  },
}));

vi.mock('./circuitManager', () => ({
  circuitManager: {
    disconnectComponentPin: vi.fn(),
  },
}));

describe('SchematicOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.components = [];
    store.wires = [];
    store.selectedComponentIds.clear();
  });

  describe('State Management', () => {
    it('should notify listeners when notify is called', () => {
      const listener = vi.fn();
      orchestrator.subscribe(listener);
      orchestrator.notify();
      expect(listener).toHaveBeenCalled();
      expect(store.notify).toHaveBeenCalled();
    });

    it('should remove listener when unsubscribe is called', () => {
      const listener = vi.fn();
      const unsubscribe = orchestrator.subscribe(listener);
      unsubscribe();
      orchestrator.notify();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Tool Management', () => {
    it('should reset selection and pending wire when changing tool', () => {
      store.selectedComponentIds.add('c1');
      store.pendingWire = { id: 'w1' } as any;

      orchestrator.setActiveTool('wire');

      expect(store.setTool).toHaveBeenCalledWith('wire');
      expect(store.selectedComponentIds.size).toBe(0);
      expect(store.pendingWire).toBeNull();
      expect(store.notify).toHaveBeenCalled();
    });
  });

  describe('Component Operations', () => {
    it('should add component from definition and update rotation', async () => {
      const def = { id: 'res', properties: { value: { default: '1k' } } } as any;
      const instance = { id: 'inst1', rotation: 0 } as any;
      store.components = [instance];

      const result = await orchestrator.addComponentFromDefinition(def, 10, 20, 90);

      expect(store.addComponent).toHaveBeenCalledWith(10, 20, def, undefined, '1k');
      expect(instance.rotation).toBe(90);
      expect(store.updateSpatialIndex).toHaveBeenCalled();
      expect(result).toBe(instance);
    });

    it('should move component with snapping and index update', () => {
      const comp = { id: 'c1', x: 10, y: 10 } as any;
      store.components = [comp];

      orchestrator.moveComponent('c1', 5, 5);

      expect(store.snap).toHaveBeenCalled();
      expect(comp.x).toBe(15);
      expect(comp.y).toBe(15);
      expect(store.updateSpatialIndex).toHaveBeenCalled();
      expect(store.updateWirePositions).toHaveBeenCalled();
    });

    it('should rotate component in 90 degree increments', () => {
      const comp = { id: 'c1', rotation: 0 } as any;
      store.components = [comp];

      orchestrator.rotateComponent('c1');
      expect(comp.rotation).toBe(90);

      orchestrator.rotateComponent('c1');
      expect(comp.rotation).toBe(180);

      expect(store.updateSpatialIndex).toHaveBeenCalled();
      expect(store.updateWirePositions).toHaveBeenCalled();
    });

    it('should delete component by selecting it first', () => {
      const comp = { id: 'c1' } as any;
      store.components = [comp];

      orchestrator.deleteComponent('c1');

      expect(store.selectedComponentIds.has('c1')).toBe(true);
      expect(store.deleteSelected).toHaveBeenCalled();
    });
  });

  describe('Wire Operations', () => {
    it('should create wire in store', () => {
      const start = { componentId: 'c1', pinNumber: '1' } as WorldPin;
      const end = { componentId: 'c2', pinNumber: '1' } as WorldPin;

      orchestrator.createWire(start, end);

      expect(store.createWire).toHaveBeenCalledWith(start, end, undefined);
    });

    it('should disconnect pins in circuitManager when deleting wire', () => {
      const wire = {
        id: 'w1',
        startPin: { componentId: 'c1', pinNumber: '1' },
        endPin: { componentId: 'c2', pinNumber: '1' }
      } as any;
      const comp1 = { id: 'c1', refdes: 'R1' } as any;
      const comp2 = { id: 'c2', refdes: 'R2' } as any;
      store.components = [comp1, comp2];
      store.wires = [wire];

      orchestrator.deleteWire('w1');

      expect(circuitManager.disconnectComponentPin).toHaveBeenCalledWith('R1', '1');
      expect(circuitManager.disconnectComponentPin).toHaveBeenCalledWith('R2', '1');
      expect(store.wires).not.toContain(wire);
    });
  });

  describe('Selection', () => {
    it('should update store selection', () => {
      orchestrator.setSelected('c1', true);
      expect(store.setSelected).toHaveBeenCalledWith('c1', true);

      orchestrator.toggleSelection('c2');
      expect(store.toggleSelection).toHaveBeenCalledWith('c2');

      orchestrator.clearSelection();
      expect(store.clearSelection).toHaveBeenCalled();
    });

    it('should update label selection', () => {
      orchestrator.setLabelSelected('c1', 'value', false);
      expect(store.setLabelSelected).toHaveBeenCalledWith('c1', 'value', false);

      orchestrator.toggleLabelSelection('c1', 'refdes');
      expect(store.toggleLabelSelection).toHaveBeenCalledWith('c1', 'refdes');
    });
  });
});