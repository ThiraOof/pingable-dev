// Public legal pages (/privacy, /terms, /data-deletion) — required by the
// OAuth providers (Facebook needs a reachable Privacy Policy + Data Deletion
// URL before an app can go Live). Content lives in src/content/legal/*.md so
// it ships inside the Docker image (COPY src ./src) and renders via the shared
// `markdown` Nunjucks filter.
import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const contentDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'legal');

const PAGES = {
  privacy: { title: 'นโยบายความเป็นส่วนตัว', file: 'privacy.md' },
  terms: { title: 'ข้อกำหนดการให้บริการ', file: 'terms.md' },
  'data-deletion': { title: 'การลบข้อมูล', file: 'data-deletion.md' },
};

const router = Router();

// Read each document once at startup — they're static.
for (const [slug, { title, file }] of Object.entries(PAGES)) {
  const body = readFileSync(join(contentDir, file), 'utf8');
  router.get(`/${slug}`, (req, res) => res.render('legal.njk', { pageTitle: title, body }));
}

export default router;
