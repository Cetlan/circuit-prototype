import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchematicStore } from './schematicStore';
import { circuitManager } from '../services/circuitManager';
import { router } from '../services/router';
import type { ComponentDefinition } from '../types/schematic';

vi.mock('../services/circuitManager', () => ({
  circuitManager: {
    addComponent: vi.fn(),
    removeComponent: vi.fn(),
    connectComponentPins: vi.fn(),
  },
}));

vi.mock('../services/router', () => ({
  router: {
    route: vi.fn(() => []),
  },
}));

describe('SchematicStore', () => {
  let store: SchematicStore;
  let mockDef: ComponentDefinition;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new SchematicStore();

    mockDef = {
      id: 'resistor-def',
      prefix: 'R',
      pins: [
        { number: '1', x: 0, y: 0 },
        { number: '2', x: 10, y: 0 },
      ],
      width: 10,
      height: 5,
      img: {} as HTMLImageElement,
      properties: {
        value: { default: '1K' }
      }
    } as any;
  });

  describe('snap', () => {
    it('should snap values to the nearest 10px', () => {
      expect(store.snap(12)).toBe(10);
      expect(store.snap(17)).toBe(20);
      expect(store.snap(5)).toBe(10);
      expect(store.snap(4)).toBe(0);
    });
  });

  describe('addComponent', () => {
    it('should add a component and auto-generate refdes', () => {
      store.addComponent(10, 20, mockDef);

      expect(store.components).toHaveLength(1);
      expect(store.components[0].refdes).toBe('R1');
      expect(store.components[0].x).toBe(10);
      expect(store.components[0].y).toBe(20);
      expect(circuitManager.addComponent).toHaveBeenCalledWith(
        'R1',
        expect.any(Object),
        expect.any(Array),
        { value: '1K' }
      );
    });

    it('should increment refdes for multiple components of same type', () => {
      store.addComponent(0, 0, mockDef);
      store.addComponent(20, 0, mockDef);

      expect(store.components[0].refdes).toBe('R1');
      expect(store.components[1].refdes).toBe('R2');
    });

    it('should use provided refdes and value', () => {
      store.addComponent(0, 0, mockDef, 'U10', '100R');

      expect(store.components[0].refdes).toBe('U10');
      expect(store.components[0].value).toBe('100R');
      expect(circuitManager.addComponent).toHaveBeenCalledWith(
        'U10',
        expect.any(Object),
        expect.any(Array),
        { value: '100R' }
      );
    });
  });

  describe('Selection', () => {
    it('should handle single selection', () => {
      store.addComponent(0, 0, mockDef);
      const id = store.components[0].id;

      store.setSelected(id);
      expect(store.selectedComponentIds.has(id)).toBe(true);

      store.clearSelection();
      expect(store.selectedComponentIds.size).toBe(0);
    });

    it('should handle multi selection', () => {
      store.addComponent(0, 0, mockDef);
      store.addComponent(20, 0, mockDef);
      const id1 = store.components[0].id;
      const id2 = store.components[1].id;

      store.setSelected(id1);
      store.setSelected(id2, true);

      expect(store.selectedComponentIds.has(id1)).toBe(true);
      expect(store.selectedComponentIds.has(id2)).toBe(true);
    });

    it('should toggle selection', () => {
      store.addComponent(0, 0, mockDef);
      const id = store.components[0].id;

      store.toggleSelection(id);
      expect(store.selectedComponentIds.has(id)).toBe(true);

      store.toggleSelection(id);
      expect(store.selectedComponentIds.has(id)).toBe(false);
    });
  });

  describe('Manipulation', () => {
    it('should move only selected components and snap to grid', () => {
      store.addComponent(0, 0, mockDef);
      store.addComponent(20, 0, mockDef);
      const id1 = store.components[0].id;
      const id2 = store.components[1].id;

      store.setSelected(id1);
      const moved = store.moveSelected(12, 5);

      expect(moved).toBe(true);
      expect(store.components[0].x).toBe(10);
      expect(store.components[0].y).toBe(10);
      expect(store.components[1].x).toBe(20); // Unchanged
    });

    it('should rotate selected components and swap dimensions', () => {
      store.addComponent(0, 0, mockDef);
      const comp = store.components[0];
      store.setSelected(comp.id);

      // Width: 10, Height: 5
      store.rotateSelected();

      expect(comp.rotation).toBe(90);
      const dims = store.getCurrentDimensions(comp);
      expect(dims.width).toBe(5);
      expect(dims.height).toBe(10);
    });

    it('should delete selected components and associated wires', () => {
      store.addComponent(0, 0, mockDef);
      store.addComponent(20, 0, mockDef);
      const id1 = store.components[0].id;
      const id2 = store.components[1].id;

      // Create a wire between them
      const pin1 = { componentId: id1, pinNumber: '1', x: 0, y: 0 };
      const pin2 = { componentId: id2, pinNumber: '1', x: 20, y: 0 };
      store.createWire(pin1, pin2);

      expect(store.wires).toHaveLength(1);

      store.setSelected(id1);
      store.deleteSelected();

      expect(store.components).toHaveLength(1);
      expect(store.components[0].id).toBe(id2);
      expect(store.wires).toHaveLength(0);
      expect(circuitManager.removeComponent).toHaveBeenCalledWith(store.components[0].refdes === 'R2' ? 'R1' : 'R1');
      // Wait, if I add R1 then R2, and delete R1, I should call removeComponent('R1')
    });
  });

  describe('Wiring', () => {
    it('should create wire and notify circuitManager', () => {
      store.addComponent(0, 0, mockDef);
      store.addComponent(20, 0, mockDef);
      const c1 = store.components[0];
      const c2 = store.components[1];

      const startPin = { componentId: c1.id, pinNumber: '1', x: 0, y: 0 };
      const endPin = { componentId: c2.id, pinNumber: '1', x: 20, y: 0 };

      store.createWire(startPin, endPin);

      expect(store.wires).toHaveLength(1);
      expect(circuitManager.connectComponentPins).toHaveBeenCalledWith(
        c1.refdes, '1',
        c2.refdes, '1'
      );
    });

    it('should update wire positions when components move', () => {
      store.addComponent(0, 0, mockDef);
      store.addComponent(20, 0, mockDef);
      const c1 = store.components[0];
      const c2 = store.components[1];

      const startPin = { componentId: c1.id, pinNumber: '1', x: 0, y: 0 };
      const endPin = { componentId: c2.id, pinNumber: '1', x: 20, y: 0 };

      store.createWire(startPin, endPin);

      store.setSelected(c1.id);
      store.moveSelected(10, 0);

      const wire = store.wires[0];
      expect(wire.startPin.x).toBe(10);
      expect(wire.segments[0].x1).toBe(10);
    });
  });
});