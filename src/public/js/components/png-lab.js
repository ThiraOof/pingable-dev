import { PngEl, svgIcon, esc, define } from './core.js';

/* <png-lab course-id m l course-title title desc grade-count>
   Workspace shell server-rendered (DSD); hydrate + wire provisioning,
   stop/restart, grading modal and live objective tracking. */
define('png-lab', class extends PngEl {
  connectedCallback() {
    const sr = this.hydrate();
    const cid = this.attr('course-id'), M = this.attr('m'), L = this.attr('l');
    const gradeCount = +this.attr('grade-count', '0');
    const ICO_CHK = svgIcon('check', 14), ICO_X = svgIcon('x', 14), ICO_CHK_L = svgIcon('check', 22), ICO_X_L = svgIcon('x', 22);

    document.querySelector('png-footer')?.setAttribute('hidden', '');  // full-height page

    const $ = (id) => sr.getElementById(id);
    const labStatus = $('labStatus'), gns3Frame = $('gns3Frame'), labLoading = $('labLoading');
    const provision = $('provisionCard'), provisionSub = $('provisionSub'), provisionSteps = $('provisionSteps');
    const stoppedCard = $('stoppedCard'), btnStop = $('btnStop'), btnRestart = $('btnRestart'), btnGrade = $('btnGrade');
    const gradeModal = $('gradeModal'), resultList = $('gradeResultList'), objectiveList = $('objectiveList');
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
        if (!d.ok) throw new Error(d.error || 'start failed');
        clearInterval(timer); paintSteps(STEPS.length, { allDone: true });
        provisionSub.textContent = 'topology ready ✓'; gns3Frame.src = d.gns3Url;
        setTimeout(() => {
          labLoading.hidden = true; labStatus.textContent = 'Lab พร้อมใช้งาน';
          labStatus.className = 'lab-status status-ready'; if (btnGrade) btnGrade.disabled = false;
        }, 500);
      } catch (err) {
        clearInterval(timer); paintSteps(i, { errorIdx: i }); provision.classList.add('failed');
        provisionSub.textContent = `ข้อผิดพลาด: ${err.message}`;
        labStatus.textContent = 'เตรียม Lab ไม่สำเร็จ'; labStatus.className = 'lab-status status-error';
      }
    }
    btnStop.addEventListener('click', async () => {
      if (!confirm('หยุด Lab และลบ Topology ทั้งหมด?')) return;
      gns3Frame.src = ''; provision.hidden = true; stoppedCard.hidden = false; labLoading.hidden = false;
      labStatus.textContent = 'กำลังหยุด...'; labStatus.className = 'lab-status status-loading';
      await fetch('/lab/stop', { method: 'POST' });
      labStatus.textContent = 'Lab หยุดทำงานแล้ว'; labStatus.className = 'lab-status status-stopped';
      if (btnGrade) btnGrade.disabled = true;
    });
    if (btnRestart) btnRestart.addEventListener('click', startLab);

    const sidebar = $('labSidebar'), scrim = $('labScrim'), btnToggle = $('btnToggleSidebar');
    if (btnToggle) btnToggle.addEventListener('click', () => { sidebar.classList.add('open'); scrim.hidden = false; });
    if (scrim) scrim.addEventListener('click', () => { sidebar.classList.remove('open'); scrim.hidden = true; });

    const SCORE_C = 264, OBJ_C = 113;
    if (btnGrade) {
      btnGrade.addEventListener('click', async () => {
        btnGrade.disabled = true; btnGrade.textContent = 'กำลังตรวจ...';
        try {
          const res = await fetch(`/lab/${cid}/${M}/${L}/grade`, { method: 'POST' });
          const d = await res.json();
          if (!d.ok) throw new Error(d.error || 'grade failed');
          renderGrade(d); gradeModal.hidden = false;
        } catch (err) { alert(`ตรวจไม่สำเร็จ: ${err.message}`); }
        finally { btnGrade.disabled = false; btnGrade.innerHTML = `${svgIcon('badge-check', 18)} ตรวจคำตอบ (${gradeCount} ข้อ)`; }
      });
    }
    const btnClose = $('btnCloseModal');
    if (btnClose) btnClose.addEventListener('click', () => { gradeModal.hidden = true; });
    gradeModal.addEventListener('click', (e) => { if (e.target === gradeModal) gradeModal.hidden = true; });

    function renderGrade({ score, total, results }) {
      const pct = total > 0 ? Math.round((score / total) * 100) : 0;
      const passed = pct >= 60, okCount = results.filter((r) => r.passed).length;
      const scoreRing = $('scoreRing'), scoreFill = $('scoreRingFill');
      scoreRing.className = 'score-ring ' + (passed ? 'pass' : 'fail');
      scoreFill.style.strokeDashoffset = SCORE_C;
      requestAnimationFrame(() => requestAnimationFrame(() => { scoreFill.style.strokeDashoffset = SCORE_C * (1 - pct / 100); }));
      $('scorePct').textContent = pct + '%';
      const banner = $('gradeBanner');
      banner.innerHTML = (passed ? ICO_CHK_L + ' ผ่านแล้ว!' : ICO_X_L + ' ยังไม่ผ่าน — ลองอีกครั้ง');
      banner.className = 'grade-banner ' + (passed ? 'pass' : 'fail');
      $('gradeScoreText').textContent = `ได้ ${score} จาก ${total} คะแนน · ผ่าน ${okCount}/${results.length} ข้อ`;
      resultList.innerHTML = '';
      for (const r of results) {
        const li = document.createElement('li');
        li.className = 'grade-result-item' + (r.output ? ' has-output' : '');
        li.innerHTML =
          `<div class="grade-result-row"><span class="grade-icon ${r.passed ? 'pass' : 'fail'}">${r.passed ? ICO_CHK : ICO_X}</span>` +
          `<span class="grade-desc">${esc(r.description)}</span><span class="grade-pts">${r.passed ? r.points : 0} / ${r.points} pt</span>` +
          (r.output ? '<span class="grade-toggle">output ▾</span>' : '') + `</div>` +
          (r.output ? `<pre class="grade-output">${esc(r.output)}</pre>` : '');
        if (r.output) li.querySelector('.grade-result-row').addEventListener('click', () => li.classList.toggle('expanded'));
        resultList.appendChild(li);
      }
      updateObjectives(results);
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

    startLab();
  }
});
