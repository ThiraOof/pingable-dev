/* ════════════════════════════════════════════════════════════════════
   Pingable — Web Component client core
   Components HYDRATE the server-rendered Declarative Shadow DOM (see
   src/dsd.js). Shadow markup lives server-side; the client only adopts
   the shared stylesheet and wires up interactivity.
   ════════════════════════════════════════════════════════════════════ */
import { ICONS, svgIcon, esc, TYPE_ICON, TYPE_LABEL } from './shared.js';
export { ICONS, svgIcon, esc, TYPE_ICON, TYPE_LABEL };

/* ── Shared stylesheet (parsed once, shared across all shadow roots) ── */
let _sheet;
export function loadSheet() {
  if (_sheet) return _sheet;
  _sheet = fetch('/css/styles.css')
    .then((r) => r.text())
    .then((css) => {
      try { const s = new CSSStyleSheet(); s.replaceSync(css); return s; }
      catch (_e) { return css; }
    })
    .catch(() => '');
  return _sheet;
}
/** Adopt the shared sheet, then drop the per-shadow DSD <link> (dedupe parsing). */
export function applySheet(sr) {
  loadSheet().then((s) => {
    if (!s) return;
    if (typeof s === 'string') {
      if (!sr.querySelector('style[data-png-fallback]')) {
        const st = document.createElement('style'); st.dataset.pngFallback = ''; st.textContent = s; sr.prepend(st);
      }
    } else {
      sr.adoptedStyleSheets = [...sr.adoptedStyleSheets, s];
    }
    sr.querySelector('link[data-png-style]')?.remove();
  });
}

export const define = (n, c) => { if (!customElements.get(n)) customElements.define(n, c); };

/* ── Base element ───────────────────────────────────────────────────── */
export class PngEl extends HTMLElement {
  attr(name, def = '') { return this.getAttribute(name) ?? def; }
  has(name) { return this.hasAttribute(name); }
  json(slot) {
    const el = this.querySelector(`script[type="application/json"]${slot ? `[data-slot="${slot}"]` : ''}`);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (_e) { return null; }
  }
  /** Hydrate the declarative shadow root the server emitted (fallback: empty shadow). */
  hydrate() {
    this._sr = this.shadowRoot || this.attachShadow({ mode: 'open' });
    applySheet(this._sr);
    return this._sr;
  }
}

/** Presentational components: nothing to wire, just adopt styles. */
export class Hydrating extends PngEl {
  connectedCallback() { this.hydrate(); }
}

/** Register a presentational/section custom element (markup is server-rendered). */
export function sectionEl(tag) { define(tag, class extends Hydrating {}); }
