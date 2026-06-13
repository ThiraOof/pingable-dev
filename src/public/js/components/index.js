/* ════════════════════════════════════════════════════════════════════
   Pingable — Web Component registry
   Single entry point loaded by base.njk as a deferred ES module.
   Importing each file runs its define() side-effect, registering the
   custom element. One component per file; shared code in core.js.
   ════════════════════════════════════════════════════════════════════ */

/* Atomic */
import './png-icon.js';
import './png-mascot.js';
import './png-button.js';
import './png-badge.js';
import './png-chip.js';
import './png-eyebrow.js';
import './png-stat.js';
import './png-feature.js';
import './png-terminal.js';
import './png-progress-ring.js';

/* Layout */
import './png-navbar.js';
import './png-footer.js';
import './png-hero.js';
import './png-features.js';
import './png-signal-band.js';
import './png-auth.js';
import './png-cta.js';
import './png-page-header.js';
import './png-course-card.js';
import './png-level-lane.js';

/* Interactive */
import './png-modules.js';
import './png-lesson-footer.js';
import './png-quiz.js';
import './png-lab.js';
import './png-exam.js';
import './png-duel.js';
