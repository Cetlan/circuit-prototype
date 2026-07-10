import './components/schematic-canvas';
import './components/toolbar';
import { store } from './store/schematicStore';

document.getElementById('app')!.innerHTML = `
    <app-toolbar></app-toolbar>
    <schematic-canvas></schematic-canvas>
`;

(async () => {
  await store.library.loadComponent('resistor', `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
  <!-- Resistor Trace -->
  <path
    d="M 0,30 L 30,30 L 35,10 L 45,50 L 55,10 L 65,50 L 75,10 L 85,50 L 95,10 L 105,50 L 110,30 L 140,30"
    fill="none"
    stroke="#000000"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- "Invisible" Pin 1 Anchor -->
  <circle
    cx="0"
    cy="30"
    r="5"
    fill="none"
    stroke="none"
    opacity="0"
    data-pin-number="1"
  />

  <!-- "Invisible" Pin 2 Anchor -->
  <circle
    cx="140"
    cy="30"
    r="5"
    fill="none"
    stroke="none"
    opacity="0"
    data-pin-number="2"
  />
</svg>
    `);
  store.notify();
})();
