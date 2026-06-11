import { PngEl, define } from './core.js';

/* <png-navbar username> — hydrate + mark active nav link based on current path */
define('png-navbar', class extends PngEl {
  connectedCallback() {
    const sr = this.hydrate();
    const path = window.location.pathname;
    sr.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      const active = href !== '/' ? path.startsWith(href) : path === '/';
      if (active) a.classList.add('nav-active');
    });
  }
});
