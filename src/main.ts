import './components/schematic-canvas';
import './components/toolbar';
import { store } from './store/schematicStore';

store.init();

document.getElementById('app')!.innerHTML = `
    <app-toolbar></app-toolbar>
    <schematic-canvas></schematic-canvas>
`;

(async () => {
  try {
    await Promise.all([
      store.library.loadComponentFromFile('resistor', 'src/symbols/resistor.svg'),
      store.library.loadComponentFromFile('capacitor', 'src/symbols/capacitor.svg'),
      store.library.loadComponentFromFile('inductor', 'src/symbols/inductor.svg'),
      store.library.loadComponentFromFile('diode', 'src/symbols/diode.svg'),
      store.library.loadComponentFromFile('NPN transistor', 'src/symbols/npn.svg'),
    ]);
    store.notify();
  } catch (e) {
    console.error('Failed to load component symbols:', e);
  }
})();
