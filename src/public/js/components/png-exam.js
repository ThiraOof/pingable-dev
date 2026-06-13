import { PngEl, define } from './core.js';

/* <png-exam number total seconds-left lab-title gns3-url>
   Exam runner: server-authoritative countdown + boot poll, grade/skip/abandon.
   The displayed timer is cosmetic — every grade is re-checked against the
   server clock; status polling resyncs secondsLeft so a tampered client can't
   buy time. */
define('png-exam', class extends PngEl {
  connectedCallback() {
    const sr = this.hydrate();
    const $ = (id) => sr.getElementById(id);
    const timerEl = $('examTimer'), statusEl = $('examStatus'), loading = $('examLoading');
    const frame = $('examFrame');
    const btnGrade = $('btnExamGrade'), btnSkip = $('btnExamSkip'), btnAbandon = $('btnExamAbandon');
    if (!timerEl) return;

    document.querySelector('png-footer')?.setAttribute('hidden', '');
    let secondsLeft = +this.attr('seconds-left', '0');
    let ready = false, finishing = false;

    const fmt = (s) => {
      s = Math.max(0, s);
      const m = Math.floor(s / 60);
      return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    const paintTimer = () => {
      timerEl.textContent = fmt(secondsLeft);
      timerEl.classList.toggle('urgent', secondsLeft <= 120);
    };
    paintTimer();

    // นาฬิกาฝั่ง client เดินทุกวินาที (แค่จอแสดงผล) — หมดเวลาให้ลองตรวจเพื่อให้
    // server ปิดสอบและส่ง resultUrl กลับมา
    const ticker = setInterval(() => {
      secondsLeft -= 1; paintTimer();
      if (secondsLeft <= 0 && !finishing) { clearInterval(ticker); submitExpiryCheck(); }
    }, 1000);

    async function submitExpiryCheck() {
      // ยิง grade เพื่อให้ server ตัดสินว่าหมดเวลาแล้วปิดสอบ
      try {
        const r = await fetch('/exam/grade', { method: 'POST' });
        const d = await r.json();
        if (d.resultUrl) location.href = d.resultUrl;
      } catch {}
    }

    function setReady(on) {
      ready = on;
      btnGrade.disabled = !on;
      statusEl.textContent = on ? 'พร้อมตรวจ' : 'กำลังบูตอุปกรณ์…';
    }

    let poll = null;
    function watch() {
      if (poll) clearInterval(poll);
      const tick = async () => {
        try {
          const st = await (await fetch('/exam/run/status')).json();
          if (!st.ok) return;
          if (st.done || st.expired) { location.href = st.expired ? location.pathname : '/exam'; return; }
          if (typeof st.secondsLeft === 'number') { secondsLeft = st.secondsLeft; paintTimer(); } // resync
          if (st.gns3Url && !frame.src) { frame.src = st.gns3Url; loading.hidden = true; }
          if (st.gns3Url) loading.hidden = true;
          const booted = st.allBooted && (st.setup === 'none' || st.setup === 'done');
          if (st.setup === 'failed') { statusEl.textContent = 'จัดฉากโจทย์ไม่สำเร็จ'; return; }
          if (st.allBooted && st.setup && st.setup !== 'none' && st.setup !== 'done') statusEl.textContent = 'กำลังจัดฉากโจทย์… 🎬';
          setReady(!!booted);
        } catch {}
      };
      poll = setInterval(tick, 5000); tick();
    }
    if (this.attr('gns3-url')) { frame.src = this.attr('gns3-url'); loading.hidden = true; }
    watch();

    async function advance(url, confirmMsg) {
      if (confirmMsg && !confirm(confirmMsg)) return;
      finishing = true;
      [btnGrade, btnSkip, btnAbandon].forEach((b) => { b.disabled = true; });
      statusEl.textContent = 'กำลังบันทึกผล…';
      try {
        const r = await fetch(url, { method: 'POST' });
        const d = await r.json();
        if (d.resultUrl) { location.href = d.resultUrl; return; }
        if (d.done || d.expired) { location.href = d.resultUrl || '/exam'; return; }
        if (d.next) { location.reload(); return; } // ข้อถัดไปเริ่มแล้วฝั่ง server — โหลดหน้าใหม่
        // ไม่พร้อม (เช่น ยังจัดฉากอยู่) — ปลดปุ่มให้ลองใหม่
        finishing = false; statusEl.textContent = d.error || 'ลองใหม่อีกครั้ง';
        btnSkip.disabled = false; btnAbandon.disabled = false; btnGrade.disabled = !ready;
      } catch {
        finishing = false; statusEl.textContent = 'เกิดข้อผิดพลาด ลองใหม่';
        btnSkip.disabled = false; btnAbandon.disabled = false; btnGrade.disabled = !ready;
      }
    }

    btnGrade.addEventListener('click', () => advance('/exam/grade'));
    btnSkip.addEventListener('click', () => advance('/exam/skip', 'ข้ามข้อนี้? จะนับว่าไม่ผ่าน และไปข้อถัดไปทันที'));
    btnAbandon.addEventListener('click', () => advance('/exam/abandon', 'ยอมแพ้และจบการสอบตอนนี้?'));
  }
});
