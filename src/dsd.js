/* ════════════════════════════════════════════════════════════════════
   Pingable — server-side Declarative Shadow DOM renderer
   Post-processes rendered HTML: for each <png-*> element it injects a
   <template shadowrootmode="open"> as the first child, so the browser
   attaches the shadow root during parsing (SSR + works with no JS).
   The client then hydrates these shadow roots (see components/core.js).

   Single source of shadow markup (T) — shared with the browser only for
   pure helpers (svgIcon/esc) via public/js/components/shared.js.
   ════════════════════════════════════════════════════════════════════ */
import { svgIcon, esc, TYPE_ICON, TYPE_LABEL } from './public/js/components/shared.js';

const BLOCK = ':host{display:block}';

/* ── Per-tag shadow templates: (attrs, data) → { host, html } ───────── */
const T = {
  'png-icon': (a) => ({ host: ':host{display:inline-flex;vertical-align:-.18em;line-height:0}', html: svgIcon(a.name, a.size || '24') }),

  'png-button': (a) => {
    const cls = ['btn', `btn-${a.variant || 'primary'}`];
    if (a.size) cls.push(`btn-${a.size}`);
    if ('block' in a) cls.push('btn-block');
    const inner = `${a.icon ? svgIcon(a.icon, 18) : ''}<slot></slot>${a['icon-end'] ? svgIcon(a['icon-end'], 18) : ''}`;
    const host = `:host{display:${'block' in a ? 'block' : 'inline-flex'}}:host([block]){display:block}`;
    const html = a.href
      ? `<a class="${cls.join(' ')}" href="${esc(a.href)}" part="btn">${inner}</a>`
      : `<button class="${cls.join(' ')}" type="button" part="btn"${'disabled' in a ? ' disabled' : ''}>${inner}</button>`;
    return { host, html };
  },

  'png-badge': (a) => {
    if (a.variant === 'soon') return { host: ':host{display:inline-flex}', html: `<span class="badge-soon">${svgIcon('clock', 13)}<slot></slot></span>` };
    if (a.variant === 'track') return { host: ':host{display:inline-block}', html: `<span class="course-track inline"><slot></slot></span>` };
    return { host: ':host{display:inline-block}', html: `<span class="course-level level-${esc(a.variant)}"><slot></slot></span>` };
  },

  'png-chip': (a) => {
    const klass = a.kind === 'lab' ? 'lab-tag' : a.kind === 'lesson' ? 'lesson-tag' : 'meta-chip';
    return { host: ':host{display:inline-flex}', html: `<span class="${klass}">${a.icon ? svgIcon(a.icon, 13) : ''}<slot></slot></span>` };
  },

  'png-eyebrow': (a) => ({ host: ':host{display:inline-flex}', html: `<span class="eyebrow">${'live' in a ? '<span class="dot-live"></span>' : ''}<slot></slot></span>` }),

  'png-stat': (a) => (a.kind === 'signal')
    ? { host: BLOCK, html: `<div class="signal-stat"><span class="sig-icon">${svgIcon(a.icon, 22)}</span><div><div class="sig-val">${esc(a.value)}</div><div class="sig-label">${esc(a.label)}</div></div></div>` }
    : { host: BLOCK, html: `<div class="hero-stat"><strong>${esc(a.value)}</strong><span>${esc(a.label)}</span></div>` },

  'png-feature': (a) => ({ host: BLOCK, html: `<div class="feature-card"><div class="feature-icon">${svgIcon(a.icon, 24)}</div><h3>${esc(a.heading)}</h3><p><slot></slot></p></div>` }),

  'png-terminal': (a) => ({ host: BLOCK, html: `<div class="terminal-preview"><div class="terminal-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="terminal-title">${esc(a.title)}</span></div><div class="terminal-body"><slot></slot></div></div>` }),

  'png-progress-ring': (a) => {
    const size = +(a.size || 44), sw = size >= 60 ? 5 : 4, r = (size - sw * 2) / 2, c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, +(a.percent || 0))), off = c * (1 - pct / 100);
    const label = a.label != null && a.label !== '' ? a.label : pct + '%';
    return {
      host: ':host{display:inline-block}',
      html: `<div class="progress-ring${size >= 60 ? ' lg' : ''}"><svg width="${size}" height="${size}"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="fill" cx="${size / 2}" cy="${size / 2}" r="${r}" style="stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/></svg><span class="label">${esc(label)}</span></div>`,
    };
  },

  'png-navbar': (a) => {
    const glyph = `<span class="brand-mark"><svg class="brand-glyph" width="26" height="26" viewBox="0 0 24 24" fill="none"><circle class="topo-ping" cx="12" cy="12" r="5"/><circle class="topo-ping ping-2" cx="12" cy="12" r="5"/><circle class="topo-core" cx="12" cy="12" r="3.4"/></svg></span>`;
    const links = a.username
      ? `<a href="/dashboard">${svgIcon('gauge', 18)} แดชบอร์ด</a><a href="/courses">${svgIcon('layers', 18)} คอร์สเรียน</a><span class="nav-user">${svgIcon('user', 16)} ${esc(a.username)}</span><form method="POST" action="/auth/logout" style="display:inline"><button type="submit" class="btn-link">${svgIcon('logout', 16)} ออกจากระบบ</button></form>`
      : `<a href="/courses">${svgIcon('layers', 18)} คอร์สเรียน</a><a href="/auth/login">เข้าสู่ระบบ</a><a href="/auth/register" class="btn btn-primary">สมัครฟรี</a>`;
    return { host: BLOCK, html: `<nav class="navbar"><a href="/" class="nav-brand">${glyph} Pingable</a><div class="nav-links">${links}</div></nav>` };
  },

  'png-footer': () => ({ host: BLOCK, html: `<footer class="footer"><div class="footer-inner"><span class="footer-brand">${svgIcon('activity', 16)} Pingable</span><span>เรียน Network ผ่าน Lab จริงในเบราว์เซอร์</span><span class="footer-copy">&copy; 2026 Pingable — Network Labs ออนไลน์</span></div></footer>` }),

  'png-hero': () => ({ host: BLOCK, html: `<section class="hero"><slot></slot></section>` }),
  'png-features': () => ({ host: BLOCK, html: `<section class="features"><div class="features-inner"><slot></slot></div></section>` }),
  'png-signal-band': () => ({ host: BLOCK, html: `<section class="signal-band"><div class="signal-inner"><slot></slot></div></section>` }),
  'png-auth': () => ({ host: BLOCK, html: `<div class="auth-split"><slot></slot></div>` }),

  'png-cta': (a) => ({ host: BLOCK, html: `<section class="cta-band"><div class="cta-inner"><div class="cta-text"><h2>${esc(a.heading)}</h2><p>${esc(a.text)}</p></div><div class="hero-actions"><slot></slot></div></div></section>` }),

  'png-page-header': (a) => ({ host: BLOCK, html: `<div class="page-header"><h1>${esc(a.title)}</h1><p>${esc(a.subtitle)}</p></div>` }),

  'png-course-card': (a) => {
    const pct = +(a.percent || 0), soon = 'soon' in a;
    const cover = `<div class="course-cover"><svg viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><line class="topo-l" x1="62" y1="44" x2="150" y2="32"/><line class="topo-l" x1="150" y1="32" x2="238" y2="56"/><line class="topo-l" x1="62" y1="44" x2="92" y2="112"/><line class="topo-l" x1="150" y1="32" x2="92" y2="112"/><line class="topo-l" x1="150" y1="32" x2="192" y2="120"/><line class="topo-l" x1="238" y1="56" x2="192" y2="120"/><line class="topo-l" x1="92" y1="112" x2="192" y2="120"/><circle class="topo-n" cx="62" cy="44" r="5"/><circle class="topo-n alt" cx="150" cy="32" r="6"/><circle class="topo-n" cx="238" cy="56" r="5"/><circle class="topo-n" cx="92" cy="112" r="5"/><circle class="topo-n alt" cx="192" cy="120" r="5"/></svg>${a.track ? `<span class="course-track">${esc(a.track)}</span>` : ''}${pct > 0 ? `<span class="course-pct-badge">${pct}%</span>` : ''}</div>`;
    let meta;
    if (soon) { meta = `<span class="badge-soon">${svgIcon('clock', 13)} เร็วๆ นี้</span>`; }
    else {
      const chips = [`<span class="meta-chip">${svgIcon('layers', 13)} ${esc(a.modules)} โมดูล</span>`];
      if (+(a.readings || 0)) chips.push(`<span class="meta-chip">${svgIcon('book-open', 13)} ${esc(a.readings)}</span>`);
      if (+(a.labs || 0)) chips.push(`<span class="meta-chip">${svgIcon('flask', 13)} ${esc(a.labs)}</span>`);
      if (+(a.quizzes || 0)) chips.push(`<span class="meta-chip">${svgIcon('help', 13)} ${esc(a.quizzes)}</span>`);
      if (+(a.hours || 0)) chips.push(`<span class="meta-chip">${svgIcon('clock', 13)} ${esc(a.hours)} ชม.</span>`);
      meta = chips.join('');
    }
    const prog = pct > 0 ? `<div class="card-progress"><span style="width:${pct}%"></span></div>` : '';
    return { host: BLOCK, html: `<a class="course-card${soon ? ' soon' : ''}" href="${esc(a.href)}">${cover}<div class="course-info"><h3>${esc(a.title)}</h3><p>${esc(a.desc)}</p><div class="course-meta">${meta}</div>${prog}</div></a>` };
  },

  'png-level-lane': (a) => ({ host: BLOCK, html: `<section class="level-lane"><div class="lane-head"><span class="course-level level-${esc(a.level)}">${esc(a.label)}</span><span class="lane-count">${esc(a.count)} คอร์ส</span></div><div class="course-grid"><slot></slot></div></section>` }),

  'png-modules': (a, data) => {
    const cid = a['course-id'];
    const mods = (data && data.modules) || [];
    const blocks = mods.map((mb, i) => {
      const obj = (mb.objectives && mb.objectives.length)
        ? `<div class="module-objectives"><strong>เมื่อจบโมดูลนี้ คุณจะ:</strong><ul>${mb.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>` : '';
      const rows = mb.lessons.map((lr) => {
        const tags = [];
        if (lr.type === 'lab' && lr.nodeCount) tags.push(`<span class="lesson-tag">${svgIcon('route', 13)} ${lr.nodeCount} โหนด</span>`);
        if (lr.type === 'quiz' && lr.qCount) tags.push(`<span class="lesson-tag">${lr.qCount} ข้อ</span>`);
        if (lr.estMinutes) tags.push(`<span class="lesson-tag">${svgIcon('clock', 13)} ${lr.estMinutes} น.</span>`);
        return `<li class="lesson-row${lr.completed ? ' done' : ''}"><a href="/learn/${esc(cid)}/${lr.m}/${lr.l}"><span class="lesson-check">${lr.completed ? svgIcon('check', 14) : ''}</span><span class="lesson-type-chip type-${lr.type}">${svgIcon(TYPE_ICON[lr.type], 13)} ${TYPE_LABEL[lr.type]}</span><span class="lesson-title">${esc(lr.title)}</span><span class="lesson-meta">${tags.join('')}</span></a></li>`;
      }).join('');
      return `<details class="module-block"${mb.percent < 100 && i === 0 ? ' open' : ''}><summary class="module-summary"><span class="module-index">${i + 1}</span><span class="module-titles"><strong>${esc(mb.title)}</strong>${mb.description ? `<small>${esc(mb.description)}</small>` : ''}</span><span class="module-progress"><span class="mp-count">${mb.doneCount}/${mb.total}</span><span class="mp-bar"><span style="width:${mb.percent}%"></span></span></span></summary>${obj}<ul class="lesson-rows">${rows}</ul></details>`;
    }).join('');
    const empty = `<div class="empty-state"><p>คอร์สนี้กำลังจัดเตรียมเนื้อหา — กลับมาดูใหม่เร็วๆ นี้</p></div>`;
    return { host: BLOCK, html: `<div class="module-list">${blocks || empty}</div>` };
  },

  'png-lesson-footer': (a) => {
    const done = 'completed' in a;
    const prevBtn = a['prev-href'] ? `<a class="btn btn-ghost" href="${esc(a['prev-href'])}">${svgIcon('arrow-left', 16)} ก่อนหน้า</a>` : '';
    const nextBtn = a['next-href'] ? `<a class="btn btn-ghost" id="nextLink" href="${esc(a['next-href'])}">ถัดไป ${svgIcon('arrow-right', 16)}</a>` : '';
    const label = done ? `${svgIcon('check', 18)} เรียนจบแล้ว` : 'เรียนจบบทนี้';
    return { host: BLOCK, html: `<div class="lesson-footer"><div class="lesson-nav">${prevBtn}</div><button id="btnComplete" class="btn btn-primary${done ? ' is-done' : ''}">${label}</button><div class="lesson-nav right">${nextBtn}</div></div>` };
  },

  'png-quiz': (a, data) => {
    const qs = (data && data.questions) || [];
    const fields = qs.map((q, qi) => {
      const hint = q.multi ? `<p class="quiz-hint">${svgIcon('sparkles', 14)} เลือกได้มากกว่า 1 ข้อ</p>` : '';
      const choices = q.choices.map((ch, ci) => `<label class="quiz-choice"><input type="${q.multi ? 'checkbox' : 'radio'}" name="question-${qi}" value="${ci}"><span class="choice-mark"></span><span class="choice-text">${esc(ch)}</span></label>`).join('');
      return `<fieldset class="quiz-q" data-qid="${qi}"><legend><span class="qnum">${qi + 1}</span> <span class="prose-inline">${q.promptHtml || esc(q.prompt)}</span></legend>${hint}<div class="quiz-choices">${choices}</div><div class="quiz-explain" hidden></div></fieldset>`;
    }).join('');
    const html = `<form id="quizForm">${fields}<div class="lesson-footer"><div></div><button type="submit" id="btnSubmit" class="btn btn-primary">ส่งคำตอบ</button><div class="lesson-nav right"></div></div></form><div id="quizResult" class="quiz-result" hidden><div class="score-ring" id="scoreRing"><svg width="96" height="96"><circle class="track" cx="48" cy="48" r="42"/><circle class="fill" id="scoreRingFill" cx="48" cy="48" r="42"/></svg><div class="center"><div><span class="pct" id="scorePct">0%</span><small>คะแนน</small></div></div></div><div class="quiz-result-meta"><div class="grade-banner" id="quizBanner"></div><p id="quizScoreText"></p></div></div>`;
    return { host: BLOCK, html };
  },

  'png-lab': (a, data) => {
    const cid = a['course-id'], gradeCount = +(a['grade-count'] || 0);
    const objectives = (data && data.objectives) || [], hints = (data && data.hints) || [];
    const objList = objectives.length
      ? `<div class="sidebar-section"><div class="sidebar-section-head"><h3>เป้าหมาย (${objectives.length})</h3><div class="progress-ring" id="objRing"><svg width="44" height="44"><circle class="track" cx="22" cy="22" r="18"/><circle class="fill" id="objRingFill" cx="22" cy="22" r="18"/></svg><span class="label" id="objRingLabel">0/${objectives.length}</span></div></div><ul class="objective-list" id="objectiveList">${objectives.map((o, i) => `<li data-index="${i}"><span class="objective-check">○</span> ${esc(o)}</li>`).join('')}</ul></div>`
      : '';
    const hintList = hints.length
      ? `<div class="sidebar-section"><h3>คำใบ้</h3>${hints.map((h, i) => `<details class="hint-item"><summary>${svgIcon('arrow-right', 14)} คำใบ้ที่ ${i + 1}</summary><p>${esc(h)}</p></details>`).join('')}</div>`
      : '';
    const gradeBtn = gradeCount ? `<button id="btnGrade" class="btn btn-primary btn-block" disabled>${svgIcon('badge-check', 18)} ตรวจคำตอบ (${gradeCount} ข้อ)</button>` : '';
    const html = `<div class="lab-layout"><div id="labScrim" class="lab-scrim" hidden></div><aside class="lab-sidebar" id="labSidebar"><div class="lab-sidebar-header"><a href="/courses/${esc(cid)}" class="back-link">${svgIcon('arrow-left', 16)} ${esc(a['course-title'])}</a><h2>${svgIcon('flask', 22)} ${esc(a.title)}</h2><p>${esc(a.desc)}</p></div>${objList}${hintList}<div class="lab-controls">${gradeBtn}<button id="btnStop" class="btn btn-danger btn-block">${svgIcon('stop', 18)} หยุด Lab &amp; คืนทรัพยากร</button></div></aside><div id="gradeModal" class="grade-modal-overlay" hidden><div class="grade-modal"><div class="grade-modal-header"><h3>ผลการตรวจคำตอบ</h3><button id="btnCloseModal" class="grade-modal-close" aria-label="ปิด">${svgIcon('x', 22)}</button></div><div class="grade-score-hero"><div class="score-ring" id="scoreRing"><svg width="96" height="96"><circle class="track" cx="48" cy="48" r="42"/><circle class="fill" id="scoreRingFill" cx="48" cy="48" r="42"/></svg><div class="center"><div><span class="pct" id="scorePct">0%</span><small>คะแนน</small></div></div></div><div class="grade-score-meta"><div class="grade-banner" id="gradeBanner"></div><p id="gradeScoreText"></p></div></div><ul class="grade-result-list" id="gradeResultList"></ul></div></div><div class="lab-main"><div class="lab-toolbar"><button id="btnToggleSidebar" class="lab-sidebar-toggle">${svgIcon('book-open', 16)} คำแนะนำ</button><span id="labStatus" class="lab-status status-loading">กำลังเตรียม Lab...</span></div><div class="gns3-wrapper"><div id="labLoading" class="lab-loading"><div class="provision" id="provisionCard"><div class="provision-title">กำลังเตรียม Lab</div><div class="provision-sub" id="provisionSub">initializing workspace…</div><ul class="provision-steps" id="provisionSteps"></ul></div><div class="lab-stopped" id="stoppedCard" hidden>${svgIcon('stop', 40)}<p id="stoppedText">Lab หยุดทำงานแล้ว — คืนทรัพยากรเรียบร้อย</p><button class="btn btn-primary" id="btnRestart">${svgIcon('play', 18)} เริ่ม Lab ใหม่</button></div></div><iframe id="gns3Frame" class="gns3-frame" allowfullscreen></iframe></div></div></div>`;
    return { host: ':host{display:block;height:calc(100dvh - var(--nav-h))}', html };
  },
};

const DATA_TAGS = new Set(['png-modules', 'png-quiz', 'png-lab']);

/* ── HTML-attribute parsing (values are HTML-escaped in source) ─────── */
function decode(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function parseAttrs(str) {
  const out = {};
  const re = /([\w-]+)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(str))) { if (m[1]) out[m[1]] = m[2] != null ? decode(m[2]) : ''; }
  return out;
}
function extractJson(inner) {
  const m = inner.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (_e) { return null; }
}
function template(tag, attrs, data) {
  const { host, html } = T[tag](attrs, data);
  return `<template shadowrootmode="open"><link rel="stylesheet" href="/css/styles.css" data-png-style><style>${host}</style>${html}</template>`;
}

/** Inject declarative shadow roots into every <png-*> element. */
export function injectDSD(html) {
  if (!html || html.indexOf('<png-') === -1) return html;

  // 1) data components: consume inner JSON, build full shadow, drop light children
  html = html.replace(/<png-(modules|quiz|lab)\b([^>]*)>([\s\S]*?)<\/png-\1>/g, (m, tag, attrsStr, inner) => {
    const full = `png-${tag}`;
    const tpl = template(full, parseAttrs(attrsStr), extractJson(inner));
    return `<${full}${attrsStr}>${tpl}</${full}>`;
  });

  // 2) all other components: insert template as first child (keep light children as slotted)
  html = html.replace(/<png-(?!modules\b|quiz\b|lab\b)([\w-]+)\b([^>]*)>(?!\s*<template)/g, (m, tag, attrsStr) => {
    const full = `png-${tag}`;
    if (!T[full]) return m;
    return m + template(full, parseAttrs(attrsStr), null);
  });

  return html;
}
