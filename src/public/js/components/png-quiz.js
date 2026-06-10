import { PngEl, svgIcon, define } from './core.js';

/* <png-quiz course-id m l threshold>
   Questions server-rendered (DSD); hydrate + wire submit/grading. */
define('png-quiz', class extends PngEl {
  connectedCallback() {
    const sr = this.hydrate();
    const cid = this.attr('course-id'), M = this.attr('m'), L = this.attr('l');
    const SCORE_C = 264;
    const form = sr.getElementById('quizForm');
    if (!form) return;
    const fieldsets = [...form.querySelectorAll('.quiz-q')];
    const ICO_CHECK = svgIcon('check', 20), ICO_X = svgIcon('x', 20), ICO_BULB = svgIcon('lightbulb', 16);
    const collect = () => fieldsets.map((fs) => [...fs.querySelectorAll('input:checked')].map((i) => +i.value));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = sr.getElementById('btnSubmit');
      btn.disabled = true; btn.textContent = 'กำลังตรวจ...';
      try {
        const res = await fetch(`/learn/${cid}/${M}/${L}/quiz`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: collect() }),
        });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error || 'failed');
        render(d);
      } catch (err) { alert('ตรวจไม่สำเร็จ: ' + err.message); }
      finally { btn.disabled = false; btn.textContent = 'ส่งคำตอบอีกครั้ง'; }
    });

    function render(d) {
      fieldsets.forEach((fs, qi) => {
        const r = d.results[qi];
        const correct = new Set(r.correct.map(Number));
        fs.querySelectorAll('.quiz-choice').forEach((label, ci) => {
          label.classList.remove('correct', 'wrong', 'missed');
          const checked = label.querySelector('input').checked;
          if (correct.has(ci) && checked) label.classList.add('correct');
          else if (!correct.has(ci) && checked) label.classList.add('wrong');
          else if (correct.has(ci) && !checked) label.classList.add('missed');
        });
        fs.classList.toggle('q-pass', r.passed);
        fs.classList.toggle('q-fail', !r.passed);
        const ex = fs.querySelector('.quiz-explain');
        if (r.explanation) { ex.innerHTML = ICO_BULB + '<span></span>'; ex.lastChild.textContent = r.explanation; ex.hidden = false; }
      });
      const result = sr.getElementById('quizResult');
      const fill = sr.getElementById('scoreRingFill');
      sr.getElementById('scoreRing').className = 'score-ring ' + (d.passed ? 'pass' : 'fail');
      fill.style.strokeDashoffset = SCORE_C;
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.strokeDashoffset = SCORE_C * (1 - d.pct / 100); }));
      sr.getElementById('scorePct').textContent = d.pct + '%';
      const banner = sr.getElementById('quizBanner');
      banner.innerHTML = (d.passed ? ICO_CHECK + ' ผ่านแล้ว!' : ICO_X + ' ยังไม่ผ่าน — ทบทวนแล้วลองใหม่');
      banner.className = 'grade-banner ' + (d.passed ? 'pass' : 'fail');
      sr.getElementById('quizScoreText').textContent = `ได้ ${d.score} จาก ${d.total} คะแนน (ต้องได้ ${d.threshold}%)`;
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});
