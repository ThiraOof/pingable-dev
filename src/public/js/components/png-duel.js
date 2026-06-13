import { PngEl, svgIcon, define } from './core.js';

/* <png-duel duel-id role state you-name foe-name lab-title invite-url gns3-url>
   Duel room: waiting state shows an invite link + waits for the opponent; once
   running, embeds the player's own lab and polls /duel/:id/state for the
   opponent's score. Grading is server-authoritative — first to 100% wins. */
define('png-duel', class extends PngEl {
  connectedCallback() {
    const sr = this.hydrate();
    const $ = (id) => sr.getElementById(id);
    const id = this.attr('duel-id');
    let state = this.attr('state');
    document.querySelector('png-footer')?.setAttribute('hidden', '');

    // หน้ารอคู่แข่ง: เติมลิงก์เชิญ + ปุ่มคัดลอก + โพลจน running แล้วโหลดหน้าใหม่
    const inviteInput = $('duelInvite'), btnCopy = $('btnCopyInvite');
    if (inviteInput) {
      inviteInput.value = location.origin + this.attr('invite-url');
      btnCopy?.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(inviteInput.value); btnCopy.textContent = 'คัดลอกแล้ว ✓'; }
        catch { inviteInput.select(); }
      });
    }

    const youPct = $('youPct'), foePct = $('foePct'), foeName = $('foeName');
    const statusEl = $('duelStatus'), loading = $('duelLoading'), frame = $('duelFrame');
    const btnGrade = $('btnDuelGrade'), btnForfeit = $('btnDuelForfeit');
    const overlay = $('duelResult'), resultText = $('duelResultText'), resultEmoji = $('duelResultEmoji');
    let ready = false, ended = false;

    function showResult(winnerRole) {
      ended = true;
      const youWon = winnerRole === this.attr('role');
      resultEmoji.textContent = youWon ? '🏆' : '💪';
      resultText.textContent = youWon ? 'คุณชนะ! ซ่อมเสร็จก่อน' : 'คู่แข่งซ่อมเสร็จก่อน — ไว้แก้มือใหม่!';
      overlay.hidden = false;
      if (btnGrade) btnGrade.disabled = true;
    }
    const showResultBound = showResult.bind(this);

    let poll = null;
    function tick() {
      fetch(`/duel/${id}/state`).then((r) => r.json()).then((s) => {
        if (!s.ok) return;
        // ยังรอคู่แข่ง → พอเริ่ม running ให้โหลดหน้าใหม่เป็นห้องแข่งจริง
        if (state === 'open') {
          if (s.state === 'running') { location.reload(); }
          return;
        }
        if (youPct) youPct.textContent = (s.you?.pct ?? 0) + '%';
        if (foePct) foePct.textContent = (s.foe?.pct ?? 0) + '%';
        if (foeName && s.foe?.username) foeName.textContent = s.foe.username;
        if (s.gns3Url && frame && !frame.src) { frame.src = s.gns3Url; loading.hidden = true; }
        if (s.gns3Url && loading) loading.hidden = true;
        if (s.state === 'done' && !ended) return showResultBound(s.winner);
        const booted = s.allBooted && (s.setup === 'none' || s.setup === 'done');
        if (s.setup === 'failed') { statusEl.textContent = 'จัดฉากโจทย์ไม่สำเร็จ'; return; }
        if (s.allBooted && s.setup && s.setup !== 'none' && s.setup !== 'done') statusEl.textContent = 'กำลังจัดฉากโจทย์… 🎬';
        ready = !!booted;
        if (btnGrade && !ended) { btnGrade.disabled = !ready; statusEl.textContent = ready ? 'พร้อมแข่ง! กดตรวจเมื่อซ่อมเสร็จ' : 'กำลังบูตอุปกรณ์…'; }
      }).catch(() => {});
    }
    poll = setInterval(tick, state === 'open' ? 3000 : 5000); tick();

    if (this.attr('gns3-url') && frame) { frame.src = this.attr('gns3-url'); if (loading) loading.hidden = true; }

    btnGrade?.addEventListener('click', async () => {
      btnGrade.disabled = true; btnGrade.textContent = 'กำลังตรวจ…';
      try {
        const r = await fetch(`/duel/${id}/grade`, { method: 'POST' });
        const d = await r.json();
        if (!d.ok) { statusEl.textContent = d.error || 'ตรวจไม่สำเร็จ'; }
        else if (d.won) { showResultBound(this.attr('role')); }
        else if (d.finished) { tick(); } // อีกฝ่ายชนะไปแล้ว — ให้ poll แสดงผล
        else if (youPct) { youPct.textContent = d.pct + '%'; statusEl.textContent = d.pct === 100 ? 'รอผลตัดสิน…' : `ได้ ${d.pct}% — ซ่อมต่อ!`; }
      } catch { statusEl.textContent = 'เกิดข้อผิดพลาด'; }
      finally { if (!ended) { btnGrade.disabled = !ready; btnGrade.innerHTML = `${svgIcon('badge-check', 18)} ตรวจคำตอบ`; } }
    });

    btnForfeit?.addEventListener('click', async () => {
      if (!confirm('ยอมแพ้และออกจากการดวล?')) return;
      await fetch(`/duel/${id}/forfeit`, { method: 'POST' }).catch(() => {});
      location.href = '/duel';
    });

    if (btnGrade) btnGrade.innerHTML = `${svgIcon('badge-check', 18)} ตรวจคำตอบ`;
  }
});
