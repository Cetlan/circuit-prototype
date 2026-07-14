import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { circuitManager } from '../services/circuitManager.ts';

@customElement('app-netlist-viewer')
export class AppNetlistViewer extends LitElement {
  @state() private isOpen: boolean = false;

  toggle() {
    this.isOpen = !this.isOpen;
  }

  render() {
    if (!this.isOpen) return html``;

    const netlist = circuitManager.generateSpiceNetlist();

    return html`
      <div class="overlay">
        <div class="modal">
          <div class="header">
            <h2>SPICE Netlist</h2>
            <button class="close-btn" @click=${() => this.toggle()}>&times;</button>
          </div>
          <div class="content">
            <pre>${netlist}</pre>
          </div>
          <div class="footer">
            <button class="copy-btn" @click=${() => this.copyToClipboard(netlist)}>Copy to Clipboard</button>
            <button class="close-btn" @click=${() => this.toggle()}>Close</button>
          </div>
        </div>
      </div>
    `;
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert('Netlist copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy netlist:', err);
    }
  }

  static styles = css`
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: sans-serif;
    }
    .modal {
      background: white;
      width: 600px;
      max-width: 80%;
      max-height: 80vh;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .header {
      padding: 15px;
      border-bottom: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h2 { margin: 0; font-size: 1.2rem; }
    .content {
      padding: 15px;
      overflow: auto;
      background: #fafafa;
      flex-grow: 1;
    }
    pre {
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .footer {
      padding: 15px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
    }
    .copy-btn {
      padding: 6px 12px;
      cursor: pointer;
      background: #eee;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .footer .close-btn {
      padding: 6px 12px;
      background: #ddd;
      border: 1px solid #bbb;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
    }
  `;
}