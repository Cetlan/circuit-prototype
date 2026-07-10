import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store } from '../store/schematicStore.ts';
import type { Tool } from '../types/schematic.ts';
import { PlacementTool } from '../store/tools.ts';

@customElement('app-toolbar')
export class AppToolbar extends LitElement {
  // We track the ID of the active tool for CSS class matching
  @state() private activeToolId: string = store.activeTool.id;

  firstUpdated() {
    store.onLibraryUpdate(() => this.requestUpdate());
  }

  setTool(toolId: string) {
    store.setTool(toolId);
    this.activeToolId = store.activeTool.id;
  }

  render() {
    const activeTool = store.activeTool;

    // 2. If the active tool is a PlacementTool, get the definition from it
    let def = null;
    if (activeTool instanceof PlacementTool) {
      def = activeTool.definition;
    }

    return html`
            <div class="toolbar">
                <button 
                    class="tool-btn ${this.activeToolId === 'selection' ? 'active' : ''}" 
                    @click=${() => this.setTool('selection')}>
                    Selection Tool
                </button>
                
                <button
                    class="tool-btn ${this.activeToolId === 'component' ? 'active' : ''}" 
                    @click=${() => this.setTool('component')}>
                    Component Tool
                    <div class="preview-box">
                        ${def ? html`<img src=${def.img.src} />` : html`<span>...</span>`}
                    </div>
                </button>

                <button 
                    class="tool-btn ${this.activeToolId === 'wire' ? 'active' : ''}" 
                    @click=${() => this.setTool('wire')}>
                    Wiring Tool
                </button>
            </div>
        `;
  }

  static styles = css`
        .toolbar { 
            position: absolute; 
            top: 20px; 
            left: 20px; 
            display: flex; 
            gap: 10px; 
            z-index: 100; 
            background: #f0f0f0; 
            padding: 10px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .tool-btn { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            padding: 8px 12px; 
            cursor: pointer; 
            border: 1px solid #ccc; 
            background: white; 
            border-radius: 4px; 
            font-family: sans-serif; 
            gap: 5px; 
        }
        .tool-btn.active { 
            background: #ddd; 
            font-weight: bold; 
            border-color: #888;
        }
        .preview-box { 
            width: 40px; 
            height: 20px; 
            border: 1px dashed #aaa; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            background: #fafafa; 
        }
        .preview-box img { 
            width: 100%; 
            height: 100%; 
            object-fit: contain; 
        }
    `;
}