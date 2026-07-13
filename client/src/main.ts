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
    const response = await fetch('/api/components');
    if (!response.ok) throw new Error(`Failed to fetch component list: ${response.statusText}`);

    const components = await response.json() as Array<{ name: string, href: string }>;

    await Promise.all(
      components.map(c => store.library.fetchComponent(c.name, c.href))
    );

    store.notify();
  } catch (e) {
    console.error('Failed to load component symbols:', e);
  }
})();
