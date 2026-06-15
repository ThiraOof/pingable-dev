// Validate seed-data course content before it reaches the database.
// These mistakes (a grading check aiming at a node that isn't in the
// topology, an `expect` that isn't valid regex, a quiz answer index out of
// range) fail silently at runtime — a lab that can never be passed — so the
// seeder refuses to write until they're fixed.
//
// CLI:  node scripts/validate-seed.js   (also run automatically by seed.js)

import { pathToFileURL } from 'node:url';
import './load-env.js';
import { sampleVars, interpolateExpect } from '../src/services/labVariables.js';

const LESSON_TYPES = new Set(['reading', 'lab', 'quiz']);
const LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'expert']);

/** @returns {{ errors: string[], warnings: string[] }} */
export function validateCourses(courses) {
  const errors = [];
  const warnings = [];
  const slugs = new Set();

  courses.forEach((course, ci) => {
    const cid = course.slug || course.title || `course #${ci}`;
    const err = (msg) => errors.push(`${cid}: ${msg}`);
    const warn = (msg) => warnings.push(`${cid}: ${msg}`);

    if (!course.slug) err('missing slug (required for upsert-by-slug seeding)');
    else if (slugs.has(course.slug)) err(`duplicate slug "${course.slug}"`);
    else slugs.add(course.slug);
    if (!course.title) err('missing title');
    if (!LEVELS.has(course.level)) err(`level "${course.level}" not in ${[...LEVELS].join('/')}`);

    (course.modules || []).forEach((mod, m) => {
      (mod.lessons || []).forEach((lesson, l) => {
        const where = `[m${m}/l${l}] "${lesson.title || '?'}"`;
        if (!LESSON_TYPES.has(lesson.type)) {
          err(`${where} unknown lesson type "${lesson.type}"`);
          return;
        }
        if (!lesson.title) err(`${where} missing title`);

        if (lesson.type === 'lab') {
          const nodes = lesson.topology?.nodes || [];
          if (!nodes.length) err(`${where} lab has no topology nodes`);
          const names = new Set();
          for (const n of nodes) {
            if (names.has(n.name)) err(`${where} duplicate node name "${n.name}"`);
            names.add(n.name);
            if (n.templateId && /^<SET_/.test(n.templateId)) {
              warn(`${where} node "${n.name}" uses placeholder templateId — set GNS3_VYOS_TEMPLATE in .env`);
            }
          }
          (lesson.topology?.links || []).forEach((lk, i) => {
            for (const side of [1, 2]) {
              const nm = lk[`node${side}`];
              if (!names.has(nm)) err(`${where} link #${i} references unknown node "${nm}"`);
              const nodeDef = nodes.find((n) => n.name === nm);
              // VPCS has exactly one NIC — any port other than 0 silently
              // fails to wire in GNS3.
              if (nodeDef && (nodeDef.nodeType || 'vpcs') === 'vpcs' && !nodeDef.templateId && (lk[`port${side}`] || 0) !== 0) {
                err(`${where} link #${i}: VPCS node "${nm}" only has port 0 (got ${lk[`port${side}`]})`);
              }
            }
          });
          if (lesson.mode && !['config', 'troubleshoot'].includes(lesson.mode)) {
            err(`${where} unknown lab mode "${lesson.mode}"`);
          }
          (lesson.setupCommands || []).forEach((g, i) => {
            if (!names.has(g.node)) err(`${where} setupCommands #${i} targets unknown node "${g.node}"`);
            if (!(g.commands || []).length) err(`${where} setupCommands #${i} has no commands`);
          });
          if (lesson.mode === 'troubleshoot' && !(lesson.setupCommands || []).length) {
            warn(`${where} troubleshoot lab has no setupCommands — nothing will be broken`);
          }
          if (lesson.scenario) {
            if (!lesson.scenario.body) err(`${where} scenario has no body`);
            if (lesson.scenario.priority && !['low', 'medium', 'high'].includes(lesson.scenario.priority)) {
              err(`${where} scenario priority "${lesson.scenario.priority}" not in low/medium/high`);
            }
          }
          // mystery lab: ตรวจ variables และ compile expect ด้วยค่าตัวอย่าง
          // (template token จะ fail regex ถ้าไม่แทนค่าก่อน)
          const KINDS = new Set(['pick', 'int', 'ipv4Net']);
          for (const v of lesson.variables || []) {
            if (!v.name) err(`${where} variable missing name`);
            if (!KINDS.has(v.kind || 'pick')) err(`${where} variable "${v.name}" unknown kind "${v.kind}"`);
            if ((v.kind === 'pick' || v.kind === 'ipv4Net') && !(v.choices || []).length) {
              err(`${where} variable "${v.name}" (${v.kind}) needs choices`);
            }
            if (v.kind === 'int' && !(Number.isFinite(v.min) && Number.isFinite(v.max) && v.min <= v.max)) {
              err(`${where} variable "${v.name}" (int) needs min <= max`);
            }
          }
          const sample = sampleVars(lesson.variables);
          (lesson.gradingChecks || []).forEach((ck, i) => {
            if (!names.has(ck.node)) err(`${where} check #${i} ("${ck.description}") targets unknown node "${ck.node}"`);
            if (!ck.command) err(`${where} check #${i} missing command`);
            try { new RegExp(interpolateExpect(ck.expect, sample), 'i'); }
            catch (e) { err(`${where} check #${i} expect is not valid regex: ${e.message}`); }
          });
          if (!(lesson.gradingChecks || []).length) warn(`${where} lab has no grading checks`);
        }

        if (lesson.type === 'quiz') {
          const qs = lesson.questions || [];
          if (!qs.length) err(`${where} quiz has no questions`);
          qs.forEach((q, i) => {
            const choices = q.choices || [];
            if (choices.length < 2) err(`${where} q#${i} has fewer than 2 choices`);
            const answers = q.answer || [];
            if (!answers.length) err(`${where} q#${i} has no answer`);
            for (const a of answers) {
              if (!Number.isInteger(a) || a < 0 || a >= choices.length) {
                err(`${where} q#${i} answer index ${a} out of range (0–${choices.length - 1})`);
              }
            }
          });
        }

        if (lesson.type === 'reading' && !(lesson.sections || []).length) {
          warn(`${where} reading has no sections`);
        }
      });
    });
  });

  return { errors, warnings };
}

/** Print results; returns true when there are no errors. */
export function reportValidation({ errors, warnings }) {
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  for (const e of errors) console.error(`  ✖ ${e}`);
  if (errors.length) {
    console.error(`Seed validation failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
    return false;
  }
  console.log(`Seed validation OK (${warnings.length} warning(s))`);
  return true;
}

// CLI entry: node scripts/validate-seed.js
// Compare full file URLs — a basename endsWith() check wrongly matches when
// imported from seed.js ("validate-seed.js".endsWith("seed.js")) and its
// process.exit(0) would kill the seeder before it writes anything.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mods = await Promise.all([
    import('./seed-data/networking-basics.js'),
    import('./seed-data/ip-subnetting.js'),
    import('./seed-data/ccna-intro.js'),
    import('./seed-data/ccnp-core.js'),
    import('./seed-data/ccnp-advanced-routing.js'),
    import('./seed-data/network-troubleshooting.js'),
    import('./seed-data/network-security.js'),
    import('./seed-data/playground.js'),
  ]);
  const ok = reportValidation(validateCourses(mods.map((m) => m.default)));
  process.exit(ok ? 0 : 1);
}
