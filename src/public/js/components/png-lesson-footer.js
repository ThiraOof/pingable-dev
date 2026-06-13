import { PngEl, svgIcon, define } from './core.js';
import { showLevelUp } from './levelup.js';

/* <png-lesson-footer course-id m l prev-href next-href completed>
   Markup server-rendered (DSD); hydrate + wire the "complete" button. */
define('png-lesson-footer', class extends PngEl {
  connectedCallback() {
    const sr = this.hydrate();
    const cid = this.attr('course-id'), m = this.attr('m'), l = this.attr('l');
    const btn = sr.getElementById('btnComplete');
    const nextLink = sr.getElementById('nextLink');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await fetch(`/learn/${cid}/${m}/${l}/complete`, { method: 'POST' });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error || 'failed');
        btn.classList.add('is-done');
        btn.innerHTML = `${svgIcon('check', 18)} เรียนจบแล้ว`;
        const go = () => { if (nextLink) window.location.href = nextLink.href; };
        // เลื่อนขั้นจากอ่านจบ → ฉลองก่อน แล้วค่อยไปบทถัดไปเมื่อปิดโมดัล
        if (d.gamify?.levelUp) showLevelUp(d.gamify.levelUp).then(go);
        else go();
      } catch (err) { btn.disabled = false; alert('บันทึกไม่สำเร็จ: ' + err.message); }
    });
  }
});
