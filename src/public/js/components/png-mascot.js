import { PngEl, define } from './core.js';
import { mascot } from './shared.js';

/* <png-mascot state size [mark]> — Echo.
   Presentational (shadow markup rendered server-side, see dsd.js). The full
   character also re-renders its expression when `state` changes at runtime,
   so flows can react: e.g. el.setAttribute('state','happy') after a pass. */
define('png-mascot', class extends PngEl {
  static get observedAttributes() { return ['state']; }

  connectedCallback() {
    this._sr = this.hydrate();
  }

  attributeChangedCallback(name, oldV, newV) {
    if (name !== 'state' || oldV === newV) return;
    if (!this._sr || this.has('mark')) return; // not hydrated yet, or compact mark (no states)
    const svg = this._sr.querySelector('.echo-full');
    if (svg) svg.outerHTML = mascot(newV || 'idle', this.attr('size', '96'));
  }
});
