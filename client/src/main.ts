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
      store.library.fetchComponent('resistor', '/api/descriptor/resistor'),
      store.library.fetchComponent('capacitor', '/api/descriptor/capacitor'),
      store.library.fetchComponent('inductor', '/api/descriptor/inductor'),
      store.library.fetchComponent('diode', '/api/descriptor/diode'),
      store.library.fetchComponent('NPN transistor', '/api/descriptor/npn'),
    ]);
    store.notify();
  } catch (e) {
    console.error('Failed to load component symbols:', e);
  }
})();
