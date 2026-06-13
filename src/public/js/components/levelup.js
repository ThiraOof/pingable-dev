/* ════════════════════════════════════════════════════════════════════
   Level-up celebration — fired whenever award() returns `levelUp`
   (lab grade / quiz / reading). Builds a one-off modal in the light DOM
   (global .echo* + .levelup-* styles apply directly) showing the newly
   ranked Echo and the gear it just unlocked.

   showLevelUp({ title, level }) → Promise that resolves when dismissed,
   so callers can defer navigation until the celebration is acknowledged.
   ════════════════════════════════════════════════════════════════════ */
import { mascot, TIER_GEAR, esc } from './shared.js';

export function showLevelUp(levelUp) {
  if (!levelUp || !levelUp.level) return Promise.resolve();
  const { title, level } = levelUp;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const lastFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'levelup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `เลื่อนขั้นเป็น ${title}`);

  const gear = TIER_GEAR[level - 1];
  const confetti = reduce ? '' : `<div class="levelup-confetti" aria-hidden="true">${
    Array.from({ length: 16 }, (_, i) =>
      `<i style="left:${Math.round((i / 16) * 100)}%;animation-delay:${(i % 5) * 0.12}s;background:${
        ['#22c55e', '#4ade80', '#a855f7', '#c084fc', '#fbbf24'][i % 5]}"></i>`).join('')}</div>`;

  overlay.innerHTML = `<div class="levelup-card" role="document">${confetti}
    <div class="levelup-eyebrow">⭐ เลื่อนขั้น!</div>
    <div class="levelup-echo">${mascot('celebrating', 156, '', level)}</div>
    <div class="levelup-rank-label">ตำแหน่งใหม่</div>
    <h2 class="levelup-rank">${esc(title)}</h2>
    ${gear ? `<p class="levelup-gear">Echo ปลดล็อก: <strong>${esc(gear)}</strong></p>` : ''}
    <button type="button" class="btn btn-primary levelup-close">เยี่ยมไปเลย!</button>
  </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => overlay.classList.add('show'));

  return new Promise((resolve) => {
    const btn = overlay.querySelector('.levelup-close');
    let done = false;
    const close = () => {
      if (done) return; done = true;
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKey);
      const finish = () => {
        overlay.remove();
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        resolve();
      };
      reduce ? finish() : setTimeout(finish, 200);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { e.preventDefault(); btn.focus(); } // single-stop focus trap
    };
    btn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    btn.focus();
  });
}
