import { Command } from './commandManager.ts';
import { orchestrator } from './schematicOrchestrator.ts';
import { store } from '../store/schematicStore.ts';
import { circuitManager } from './circuitManager.ts';
import type { ComponentInstance, Wire, WorldPin, ComponentDefinition, WireSegment } from '../types/schematic.ts';

export class MoveComponentCommand implements Command {
  constructor(
    private ids: string[],
    private dx: number,
    private dy: number
  ) { }

  execute() {
    // We can't use orchestrator.moveSelected because it uses state.selectedComponentIds
    // which might have changed by the time we undo/redo.
    // We must move specifically the IDs we captured.
    this.ids.forEach(id => {
      orchestrator.moveComponent(id, this.dx, this.dy);
    });
  }

  undo() {
    this.ids.forEach(id => {
      orchestrator.moveComponent(id, -this.dx, -this.dy);
    });
  }
}

export class RotateComponentCommand implements Command {
  constructor(private ids: string[]) { }

  execute() {
    this.ids.forEach(id => orchestrator.rotateComponent(id));
  }

  undo() {
    this.ids.forEach(id => {
      // To undo a 90-degree rotation, rotate it 3 more times (270 degrees)
      // TODO: Clean this up when rotation the other direction is supported
      orchestrator.rotateComponent(id);
      orchestrator.rotateComponent(id);
      orchestrator.rotateComponent(id);
    });
  }
}

export class AddWireCommand implements Command {
  constructor(
    private startPin: WorldPin,
    private endPin: WorldPin,
    private segments?: WireSegment[]
  ) { }

  execute() {
    orchestrator.createWire(this.startPin, this.endPin, this.segments);
  }

  undo() {
    // Find the wire that connects these pins and delete it
    const wire = store.wires.find(w =>
      w.startPin.componentId === this.startPin.componentId &&
      w.startPin.pinNumber === this.startPin.pinNumber &&
      w.endPin.componentId === this.endPin.componentId &&
      w.endPin.pinNumber === this.endPin.pinNumber
    );
    if (wire) {
      orchestrator.deleteWire(wire.id);
    }
  }
}

export class DeleteWireCommand implements Command {
  private wire?: Wire;
  private startIndex?: number;

  constructor(private wireId: string) {
    this.startIndex = store.wires.findIndex(w => w.id === wireId);
    this.wire = store.wires[this.startIndex!];
  }

  execute() {
    orchestrator.deleteWire(this.wireId);
  }

  undo() {
    const wire = this.wire;
    if (!wire) return;

    // Restore the wire to store
    store.wires.push(wire);

    // Restore connections in circuitManager
    const startComp = store.components.find(c => c.id === wire.startPin.componentId);
    const endComp = store.components.find(c => c.id === wire.endPin.componentId);
    if (startComp && endComp) {
      circuitManager.connectComponentPins(
        startComp.refdes, wire.startPin.pinNumber,
        endComp.refdes, wire.endPin.pinNumber
      );
    }
    orchestrator.notify();
  }
}

export class DeleteComponentCommand implements Command {
  private component?: ComponentInstance;
  private compIndex?: number;
  private affectedWires: Wire[] = [];

  constructor(private compId: string) {
    this.compIndex = store.components.findIndex(c => c.id === compId);
    this.component = store.components[this.compIndex!];
    this.affectedWires = store.wires.filter(w =>
      w.startPin.componentId === compId || w.endPin.componentId === compId
    );
  }

  execute() {
    orchestrator.deleteComponent(this.compId);
  }

  undo() {
    if (!this.component) return;

    // Restore component
    store.components.splice(this.compIndex || 0, 0, this.component);

    // Restore wires and their connectivity
    this.affectedWires.forEach(wire => {
      store.wires.push(wire);
      const startComp = store.components.find(c => c.id === wire.startPin.componentId);
      const endComp = store.components.find(c => c.id === wire.endPin.componentId);
      if (startComp && endComp) {
        circuitManager.connectComponentPins(
          startComp.refdes, wire.startPin.pinNumber,
          endComp.refdes, wire.endPin.pinNumber
        );
      }
    });

    orchestrator.notify();
  }
}

export class UpdateLabelCommand implements Command {
  constructor(
    private compId: string,
    private label: 'refdes' | 'value',
    private dx: number,
    private dy: number
  ) { }

  execute() {
    orchestrator.updateLabelOffset(this.compId, this.label, this.dx, this.dy);
  }

  undo() {
    orchestrator.updateLabelOffset(this.compId, this.label, -this.dx, -this.dy);
  }
}

export class AddComponentCommand implements Command {
  private componentId?: string;

  constructor(
    private definition: ComponentDefinition,
    private x: number,
    private y: number,
    private rotation: number = 0
  ) { }

  async execute() {
    const instance = await orchestrator.addComponentFromDefinition(this.definition, this.x, this.y, this.rotation);
    this.componentId = instance.id;
  }

  undo() {
    if (this.componentId) {
      orchestrator.deleteComponent(this.componentId);
    }
  }
}
