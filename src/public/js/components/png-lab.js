import { PngEl, svgIcon, esc, define } from './core.js';

/* <png-lab course-id m l course-title title desc grade-count>
   Workspace shell server-rendered (DSD); hydrate + wire provisioning,
   stop/restart, grading modal and live objective tracking. */
define('png-lab', class extends PngEl {
  connectedCallback() {
    const sr = this.hydrate();
    const cid = this.attr('course-id'), M = this.attr('m'), L = this.attr('l');
    const gradeCount = +this.attr('grade-count', '0');
    const passThreshold = +this.attr('pass-threshold', '60');
    const ICO_CHK = svgIcon('check', 14), ICO_X = svgIcon('x', 14), ICO_CHK_L = svgIcon('check', 22), ICO_X_L = svgIcon('x', 22);

    document.querySelector('png-footer')?.setAttribute('hidden', '');  // full-height page

    const $ = (id) => sr.getElementById(id);
    const labStatus = $('labStatus'), gns3Frame = $('gns3Frame'), labLoading = $('labLoading');
    const provision = $('provisionCard'), provisionSub = $('provisionSub'), provisionSteps = $('provisionSteps');
    const stoppedCard = $('stoppedCard'), btnStop = $('btnStop'), btnRestart = $('btnRestart'), btnGrade = $('btnGrade');
    const gradeModal = $('gradeModal'), resultList = $('gradeResultList'), objectiveList = $('objectiveList');
    const historyWrap = $('labHistoryWrap'), historyList = $('labHistory');
    const histUrl = `/lab/${cid}/${M}/${L}/history`;
    if (!labStatus) return;

    const STEPS = [
      { label: 'จองทรัพยากร · allocate project' }, { label: 'สร้างโหนด · create nodes' },
      { label: 'เชื่อมต่อลิงก์ · wire links' }, { label: 'บูตอุปกรณ์ · boot devices' },
    ];
    const stepEls = STEPS.map((s, i) => {
      const li = document.createElement('li'); li.className = 'provision-step';
      li.innerHTML = `<span class="ps-icon">${i + 1}</span><span>${s.label}</span>`;
      provisionSteps.appendChild(li); return li;
    });
    function paintSteps(activeIdx, { allDone = false, errorIdx = -1 } = {}) {
      stepEls.forEach((el, idx) => {
        el.classList.toggle('done', allDone || idx < activeIdx);
        el.classList.toggle('active', !allDone && idx === activeIdx && idx !== errorIdx);
        el.classList.toggle('error', idx === errorIdx);
        el.querySelector('.ps-icon').textContent = (allDone || idx < activeIdx) ? '✓' : idx === errorIdx ? '✕' : (idx + 1);
      });
    }
    const statusUrl = `/lab/${cid}/${M}/${L}/status`;
    let pollTimer = null;
    const stopTimers = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };

    function setReady() {
      labStatus.textContent = 'Lab พร้อมใช้งาน'; labStatus.className = 'lab-status status-ready';
      if (btnGrade) btnGrade.disabled = false;
    }
    function labGone() { // ถูกปิดฝั่ง server (idle timeout) หรือหยุดจากแท็บอื่น
      stopTimers(); gns3Frame.src = '';
      provision.hidden = true; stoppedCard.hidden = false; labLoading.hidden = false;
      $('stoppedText').textContent = 'Lab ถูกปิดเพราะไม่มีการใช้งานนานเกินไป — เริ่มใหม่ได้เลย';
      labStatus.textContent = 'Lab หยุดทำงานแล้ว'; labStatus.className = 'lab-status status-stopped';
      if (btnGrade) btnGrade.disabled = true;
    }
    // โพลถี่ระหว่างอุปกรณ์บูต (VyOS ใช้ ~1-2 นาที) — เปิดปุ่มตรวจเมื่อทุก console ตอบ
    // แล้วค่อยโพลช้าเป็น heartbeat เพื่อบอก server ว่ายังเปิดหน้านี้อยู่
    function bootWatch() {
      stopTimers();
      labStatus.textContent = 'กำลังบูตอุปกรณ์…'; labStatus.className = 'lab-status status-loading';
      if (btnGrade) btnGrade.disabled = true;
      let polls = 0;
      const tick = async () => {
        try {
          const st = await (await fetch(statusUrl)).json();
          if (!st.ok) return;
          if (!st.active || !st.sameLab) return labGone();
          if (st.status !== 'ready') return;
          if (st.allBooted || ++polls > 36) { setReady(); heartbeat(); } // ~3 นาทีแล้วปล่อยให้ลองตรวจเอง
          else labStatus.textContent = `กำลังบูตอุปกรณ์… ${st.bootedCount}/${st.nodeCount}`;
        } catch { /* network สะดุด — รอบหน้าค่อยว่ากัน */ }
      };
      pollTimer = setInterval(tick, 5000); tick();
    }
    function heartbeat() {
      stopTimers();
      pollTimer = setInterval(async () => {
        try {
          const st = await (await fetch(statusUrl)).json();
          if (st.ok && !st.active) labGone();
        } catch {}
      }, 60000);
    }

    async function startLab() {
      stoppedCard.hidden = true; provision.hidden = false; provision.classList.remove('failed');
      provisionSub.textContent = 'initializing workspace…'; labLoading.hidden = false;
      labStatus.textContent = 'กำลังสร้าง Topology...'; labStatus.className = 'lab-status status-loading';
      if (btnGrade) btnGrade.disabled = true;
      let i = 0; paintSteps(0);
      const timer = setInterval(() => { if (i < STEPS.length - 1) { i++; paintSteps(i); } else clearInterval(timer); }, 850);
      try {
        const res = await fetch(`/lab/${cid}/${M}/${L}/start`, { method: 'POST' });
        const d = await res.json();
        if (!d.ok) {
          const e = new Error(d.error || 'start failed');
          e.status = res.status;
          throw e;
        }
        clearInterval(timer); paintSteps(STEPS.length, { allDone: true });
        provisionSub.textContent = 'topology ready ✓'; gns3Frame.src = d.gns3Url;
        setTimeout(() => { labLoading.hidden = true; }, 500);
        bootWatch();
      } catch (err) {
        clearInterval(timer);
        if (err.status === 503) { // ห้อง Lab เต็ม — ไม่ใช่ความผิดพลาด ให้ปุ่มลองใหม่แทน
          provision.hidden = true; stoppedCard.hidden = false;
          $('stoppedText').textContent = err.message;
          labStatus.textContent = 'ห้อง Lab เต็มชั่วคราว'; labStatus.className = 'lab-status status-stopped';
          return;
        }
        paintSteps(i, { errorIdx: i }); provision.classList.add('failed');
        provisionSub.textContent = `ข้อผิดพลาด: ${err.message}`;
        labStatus.textContent = 'เตรียม Lab ไม่สำเร็จ'; labStatus.className = 'lab-status status-error';
      }
    }
    let lastAttempts = []; // ครั้งล่าสุดไว้เทียบ "ดีขึ้น/ลดลง" ตอนตรวจรอบใหม่
    function renderHistory(attempts) {
      lastAttempts = attempts;
      if (!historyList || !historyWrap || !attempts.length) return;
      historyWrap.hidden = false;
      historyList.innerHTML = attempts.map((a) => {
        const d = new Date(a.at);
        const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const ok = a.passed, passCount = a.results.filter((r) => r.passed).length;
        return `<div class="hist-item ${ok ? 'pass' : 'fail'}" data-id="${esc(String(a._id))}">` +
          `<span class="hist-pct">${a.pct}%</span>` +
          `<span class="hist-detail">${passCount}/${a.results.length} ข้อ · ${dateStr} ${timeStr}</span>` +
          `<span class="hist-badge">${ok ? svgIcon('check', 13) : svgIcon('x', 13)}</span>` +
          `<button class="hist-share" title="คัดลอกลิงก์แชร์">${svgIcon('link', 13)}</button>` +
          `</div>`;
      }).join('');
    }
    async function loadHistory() {
      try {
        const d = await (await fetch(histUrl)).json();
        if (d.ok) renderHistory(d.attempts || []);
      } catch {}
    }
    if (historyList) {
      historyList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.hist-share');
        if (!btn) return;
        const id = btn.closest('.hist-item')?.dataset.id;
        if (!id) return;
        btn.disabled = true;
        try {
          const r = await fetch(`/lab/${cid}/${M}/${L}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attemptId: id }),
          });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || 'failed');
          const fullUrl = location.origin + d.url;
          await navigator.clipboard.writeText(fullUrl);
          btn.innerHTML = svgIcon('check', 13);
          btn.title = fullUrl;
          setTimeout(() => { btn.innerHTML = svgIcon('link', 13); btn.disabled = false; }, 2500);
        } catch {
          btn.disabled = false;
          alert('ไม่สามารถสร้างลิงก์แชร์ได้');
        }
      });
    }

    btnStop.addEventListener('click', async () => {
      if (!confirm('หยุด Lab และลบ Topology ทั้งหมด?')) return;
      stopTimers();
      $('stoppedText').textContent = 'Lab หยุดทำงานแล้ว — คืนทรัพยากรเรียบร้อย';
      gns3Frame.src = ''; provision.hidden = true; stoppedCard.hidden = false; labLoading.hidden = false;
      labStatus.textContent = 'กำลังหยุด...'; labStatus.className = 'lab-status status-loading';
      await fetch('/lab/stop', { method: 'POST' });
      labStatus.textContent = 'Lab หยุดทำงานแล้ว'; labStatus.className = 'lab-status status-stopped';
      if (btnGrade) btnGrade.disabled = true;
    });
    if (btnRestart) btnRestart.addEventListener('click', startLab);

    // คำใบ้แบบมีราคา: เนื้อหาไม่อยู่ในหน้า ต้องยิง endpoint ที่บันทึกการใช้
    sr.querySelectorAll('.hint-unlock').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = btn.closest('.hint-item'), idx = item?.dataset.idx;
        if (!item || item.classList.contains('unlocked')) return;
        btn.disabled = true;
        try {
          const r = await fetch(`/lab/${cid}/${M}/${L}/hint/${idx}`, { method: 'POST' });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || 'failed');
          const p = item.querySelector('.hint-text');
          p.textContent = d.hint; p.hidden = false;
          item.classList.remove('hint-locked'); item.classList.add('unlocked');
          btn.innerHTML = `${svgIcon('check', 14)} คำใบ้ที่ ${Number(idx) + 1}`;
        } catch (err) {
          alert(err.message || 'เปิดคำใบ้ไม่สำเร็จ');
        } finally { btn.disabled = false; }
      });
    });

    const sidebar = $('labSidebar'), scrim = $('labScrim'), btnToggle = $('btnToggleSidebar');
    if (btnToggle) btnToggle.addEventListener('click', () => { sidebar.classList.add('open'); scrim.hidden = false; });
    if (scrim) scrim.addEventListener('click', () => { sidebar.classList.remove('open'); scrim.hidden = true; });

    const SCORE_C = 264, OBJ_C = 113;
    if (btnGrade) {
      btnGrade.addEventListener('click', async () => {
        btnGrade.disabled = true; btnGrade.textContent = 'กำลังตรวจ...';
        const prevPct = lastAttempts[0]?.pct; // เก็บก่อน loadHistory จะเขียนทับด้วยรอบนี้
        try {
          const res = await fetch(`/lab/${cid}/${M}/${L}/grade`, { method: 'POST' });
          const d = await res.json();
          if (!d.ok) throw new Error(d.error || 'grade failed');
          renderGrade(d, prevPct); renderGamify(d.gamify); gradeModal.hidden = false;
          loadHistory();
        } catch (err) { alert(`ตรวจไม่สำเร็จ: ${err.message}`); }
        finally { btnGrade.disabled = false; btnGrade.innerHTML = `${svgIcon('badge-check', 18)} ตรวจคำตอบ (${gradeCount} ข้อ)`; }
      });
    }
    const btnClose = $('btnCloseModal');
    if (btnClose) btnClose.addEventListener('click', () => { gradeModal.hidden = true; });
    gradeModal.addEventListener('click', (e) => { if (e.target === gradeModal) gradeModal.hidden = true; });

    function renderGrade({ score, total, results }, prevPct) {
      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      const passed = pct >= passThreshold, okCount = results.filter((r) => r.passed).length;
      const scoreRing = $('scoreRing'), scoreFill = $('scoreRingFill');
      scoreRing.className = 'score-ring ' + (passed ? 'pass' : 'fail');
      scoreFill.style.strokeDashoffset = SCORE_C;
      requestAnimationFrame(() => requestAnimationFrame(() => { scoreFill.style.strokeDashoffset = SCORE_C * (1 - pct / 100); }));
      $('scorePct').textContent = pct + '%';
      const banner = $('gradeBanner');
      banner.innerHTML = (passed ? ICO_CHK_L + ' ผ่านแล้ว!' : ICO_X_L + ' ยังไม่ผ่าน — ลองอีกครั้ง');
      banner.className = 'grade-banner ' + (passed ? 'pass' : 'fail');
      const failCount = results.length - okCount;
      let txt = `ได้ ${score} จาก ${total} คะแนน · ผ่าน ${okCount}/${results.length} ข้อ`;
      if (failCount) txt += ` — เหลืออีก ${failCount} ข้อ (${total - score} คะแนน) ใกล้แล้ว!`;
      if (typeof prevPct === 'number') {
        const diff = pct - prevPct;
        txt += diff > 0 ? ` · ดีขึ้นจากครั้งก่อน +${diff}%` : diff < 0 ? ` · ลดลงจากครั้งก่อน ${diff}%` : ' · เท่าครั้งก่อน';
      }
      $('gradeScoreText').textContent = txt;
      resultList.innerHTML = '';
      for (const r of results) {
        const li = document.createElement('li');
        li.className = 'grade-result-item' + (r.output ? ' has-output' : '');
        li.innerHTML =
          `<div class="grade-result-row"><span class="grade-icon ${r.passed ? 'pass' : 'fail'}">${r.passed ? ICO_CHK : ICO_X}</span>` +
          `<span class="grade-desc">${esc(r.description)}</span><span class="grade-pts">${r.passed ? r.points : 0} / ${r.points} pt</span>` +
          (r.output ? '<span class="grade-toggle">output ▾</span>' : '') + `</div>` +
          (!r.passed && r.failHint ? `<div class="grade-fail-hint">${svgIcon('sparkles', 14)} ${esc(r.failHint)}</div>` : '') +
          (r.output ? `<pre class="grade-output">${esc(r.output)}</pre>` : '');
        if (r.output) li.querySelector('.grade-result-row').addEventListener('click', () => li.classList.toggle('expanded'));
        resultList.appendChild(li);
      }
      updateObjectives(results);
    }
    // แถบ XP/streak/badge ใต้สรุปคะแนน — โชว์เฉพาะตอนมีอะไรให้อวด
    function renderGamify(g) {
      sr.getElementById('gradeGamify')?.remove();
      if (!g) return;
      const chips = [];
      if (g.xpGained > 0) chips.push(`<span class="gamify-chip xp">+${g.xpGained} XP</span>`);
      if (g.levelUp) chips.push(`<span class="gamify-chip level">🎉 เลื่อนตำแหน่งเป็น ${esc(g.levelUp.title)}!</span>`);
      for (const b of g.newBadges || []) chips.push(`<span class="gamify-chip badge" title="${esc(b.desc)}">${b.icon} ${esc(b.title)}</span>`);
      if (g.streak?.daily && g.streak.current > 1) chips.push(`<span class="gamify-chip streak">🔥 ${g.streak.current} วันติด</span>`);
      if (!chips.length) return;
      const div = document.createElement('div');
      div.className = 'grade-gamify'; div.id = 'gradeGamify';
      div.innerHTML = chips.join('');
      sr.querySelector('.grade-score-meta')?.appendChild(div);
    }

    function updateObjectives(results) {
      if (!objectiveList) return;
      const items = [...objectiveList.querySelectorAll('li')];
      const total = results.length || 1, passed = results.filter((r) => r.passed).length;
      let doneCount;
      if (items.length === results.length) {
        results.forEach((r, i) => { items[i].classList.toggle('done', r.passed); items[i].querySelector('.objective-check').textContent = r.passed ? '●' : '○'; });
        doneCount = passed;
      } else {
        doneCount = Math.round((passed / total) * items.length);
        items.forEach((li, i) => { const done = i < doneCount; li.classList.toggle('done', done); li.querySelector('.objective-check').textContent = done ? '●' : '○'; });
      }
      const ringFill = $('objRingFill'), ringLabel = $('objRingLabel');
      if (ringFill && items.length) { ringFill.style.strokeDashoffset = OBJ_C * (1 - doneCount / items.length); ringLabel.textContent = `${doneCount}/${items.length}`; }
    }

    loadHistory(); // load previous attempts immediately on page open

    // ถ้า session ของ lab นี้ยังรันอยู่ (เช่น refresh หน้า) ให้ resume แทนการสร้างใหม่
    (async () => {
      try {
        const st = await (await fetch(statusUrl)).json();
        if (st.ok && st.active && st.sameLab && st.status === 'ready' && st.gns3Url) {
          gns3Frame.src = st.gns3Url; labLoading.hidden = true;
          if (st.allBooted) { setReady(); heartbeat(); } else bootWatch();
          return;
        }
      } catch {}
      startLab();
    })();
  }
});
