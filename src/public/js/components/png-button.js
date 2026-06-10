import { PngEl, define } from './core.js';

/* <png-button variant size href type icon icon-end block disabled>
   Markup is server-rendered (DSD); this hydrates + wires type="submit"
   (the native <button> lives in the shadow root, so it can't be the form's
   implicit submit control — intercept click + Enter and call requestSubmit). */
define('png-button', class extends PngEl {
  static get observedAttributes() { return ['disabled']; }
  connectedCallback() {
    const sr = this.hydrate();
    this._btn = sr.querySelector('button');
    if (this.attr('type') === 'submit') {
      this.addEventListener('click', (e) => {
        if (this.has('disabled')) { e.stopImmediatePropagation(); return; }
        e.preventDefault();
        this.closest('form')?.requestSubmit();
      });
      const form = this.closest('form');
      if (form && !form.__pngEnter) {
        form.__pngEnter = true;
        form.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') { ev.preventDefault(); form.requestSubmit(); }
        });
      }
    }
  }
  attributeChangedCallback() { if (this._btn) this._btn.disabled = this.has('disabled'); }
});
