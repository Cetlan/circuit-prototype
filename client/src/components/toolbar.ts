import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store/schematicStore.ts';
import type { ToolId } from '../types/schematic.ts';
import { AppNetlistViewer } from './netlist-viewer.ts';
import { PlacementTool } from '../store/tools/PlacementTool.ts';
import { commandManager } from '../services/commandManager.ts';

@customElement('app-toolbar')
export class AppToolbar extends LitElement {
  @state() private activeToolId: string = store.activeTool.id;
  @state() private isSelectorOpen: boolean = false;

  firstUpdated() {
    store.onLibraryUpdate(() => {
      this.activeToolId = store.activeTool.id;
    });
  }

  setTool(toolId: ToolId) {
    if (toolId === 'component') {
      store.setTool(toolId);
      this.activeToolId = store.activeTool.id;
      this.isSelectorOpen = !this.isSelectorOpen;
    } else {
      store.setTool(toolId);
      this.activeToolId = store.activeTool.id;
      this.isSelectorOpen = false;
    }
  }

  selectComponent(id: string) {
    const tool = store.activeTool;
    if (tool instanceof PlacementTool) {
      tool.setComponent(id);
      this.isSelectorOpen = false;
    }
  }

  render() {
    const activeTool = store.activeTool;
    let def = null;
    if (activeTool instanceof PlacementTool) def = activeTool.definition;

    return html`
            <div class="toolbar">
                <div class="tool-container">
                    <button class="tool-btn ${this.activeToolId === 'component' ? 'active' : ''}" @click=${() => this.setTool('component')}>
                        Place Symbol
                        <div class="preview-box">${def ? html`<img src=${def.img.src} />` : html`<span>...</span>`}</div>
                    </button>
                    <button class="tool-btn" @click=${() => {
        const viewer = document.querySelector('app-netlist-viewer') as AppNetlistViewer;
        if (viewer) viewer.toggle();
      }}>
                        View Netlist
                    </button>
                    <div class="undo-redo-group">
                        <button class="tool-btn undo-btn" @click=${() => commandManager.undo()}>Undo</button>
                        <button class="tool-btn redo-btn" @click=${() => commandManager.redo()}>Redo</button>
                    </div>
                    ${this.isSelectorOpen && activeTool instanceof PlacementTool ? html`
                        <div class="component-selector">
                            ${store.library.getIds().map(id => html`
                                <div class="component-option ${activeTool.activeComponentId === id ? 'selected' : ''}" @click=${() => this.selectComponent(id)}>
                                    ${id}
                                </div>
                            `)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
  }

  static styles = css`
         .toolbar { position: absolute; top: 20px; left: 20px; display: flex; gap: 10px; z-index: 100; background: #f0f0f0; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); align-items: center; }
         .undo-redo-group { display: flex; gap: 5px; border-left: 1px solid #ccc; padding-left: 10px; margin-left: 5px; }
        .tool-container { position: relative; }
        .tool-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 12px; cursor: pointer; border: 1px solid #ccc; background: white; border-radius: 4px; font-family: sans-serif; gap: 5px; }
        .tool-btn.active { background: #ddd; font-weight: bold; border-color: #888; }
        .preview-box { width: 40px; height: 20px; border: 1px dashed #aaa; display: flex; align-items: center; justify-content: center; background: #fafafa; }
        .preview-box img { width: 100%; height: 100%; object-fit: contain; }
        .component-selector { position: absolute; top: 100%; left: 0; width: 120px; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 101; margin-top: 4px; max-height: 200px; overflow-y: auto; }
        .component-option { padding: 6px 10px; cursor: pointer; font-family: sans-serif; font-size: 12px; border-bottom: 1px solid #eee; }
        .component-option:last-child { border-bottom: none; }
        .component-option:hover { background: #f0f0f0; }
        .component-option.selected { background: #e0e0e0; font-weight: bold; }
    `;
}