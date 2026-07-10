import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { store, type Tool } from '../store/schematicStore';

@customElement('app-toolbar')
export class AppToolbar extends LitElement {
  @state() private activeTool: Tool = store.activeTool;
  @state() private libraryLoaded = false;

  firstUpdated() {
    // Listen for store updates to refresh the UI
    store.onLibraryUpdate(() => {
      this.libraryLoaded = true;
      this.requestUpdate();
    });
  }

  setTool(tool: Tool) {
    store.setTool(tool);
    this.activeTool = tool;
  }

  render() {
    const def = store.getActiveToolDefinition();
    return html`
            <div class="toolbar">
                <button 
                    class="tool-btn ${this.activeTool === 'selection' ? 'active' : ''}" 
                    @click=${() => this.setTool('selection')}>
                    Selection Tool
                </button>
                
                <button 
                    class="tool-btn ${this.activeTool === 'component' ? 'active' : ''}" 
                    @click=${() => this.setTool('component')}>
                    Component Tool
                    <div class="preview-box">
                        ${def ? html`<img src=${def.img.src} />` : html`<span>...</span>`}
                    </div>
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
            border-color: #888;
            font-weight: bold;
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
        .preview-box span {
            font-size: 8px;
            color: #999;
        }
    `;
}