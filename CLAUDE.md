# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run with nodemon (auto-reload) at http://localhost:3000
- `npm start` — run once with plain node
- `npm run seed` — upsert the demo courses from `scripts/seed.js` **by `slug`** (course `_id`s survive re-seeding, so user progress is preserved; courses removed from the seed set are deleted)
- `npm run validate` — validate seed-data content without touching the DB (broken node refs in links/checks, invalid `expect` regexes, out-of-range quiz answers). `npm run seed` runs this automatically and refuses to write on errors.
- `npm test` — run the `node:test` suite in `tests/` (no extra deps). External services are faked in-process (`tests/helpers/`: a TCP console for the grader, a GNS3 REST server — env `GNS3_HOST/PORT` must be set **before** the services are imported, the base URL is frozen at module load); DB-backed suites use a real local MongoDB (one throwaway DB per test file) and **skip** when it's unreachable. CI (`.github/workflows/ci.yml`) runs validate → test (with a mongo service) → build on every push/PR.
- `npm run build` — bundle the 26 Web Component files (`src/public/js/components/`) into `src/public/js/bundle.js` (ESM, minified via esbuild). Run once before deploying to production. In dev (`NODE_ENV` unset or `development`) the server loads the unbundled files directly via `index.js`; in production it serves `bundle.js`. The bundle is gitignored — rebuild after any component change before deploying.

## Prerequisites for local development

The app talks to two external services; both must be running or the relevant features fail:

- **MongoDB** at `mongodb://localhost:27017/pingable-dev` (override with `MONGODB_URI`). The process calls `process.exit(1)` if it cannot connect on startup.
- **GNS3 server** at `http://localhost:3080` (override with `GNS3_HOST` / `GNS3_PORT`). Required only when starting/grading a lab, not for browsing courses.

Config is read from `.env` (gitignored; copy `.env.example` to start). Variables used in code: `PORT`, `NODE_ENV`, `SESSION_SECRET`, `MONGODB_URI`, `GNS3_HOST`, `GNS3_PORT`, `GNS3_USER`, `GNS3_PASS`, `GNS3_VYOS_TEMPLATE`, `GNS3_NODE_USER`, `GNS3_NODE_PASS`, `GNS3_PUBLIC_URL` (browser-facing GNS3 origin for the lab iframe when it differs from `GNS3_HOST`, e.g. in production; also used for CSP `frame-src`), `LAB_IDLE_MINUTES`, `LAB_MAX_CONCURRENT`, `LOG_LEVEL`.

### VyOS appliance for configuration labs

We cannot ship licensed Cisco IOS, so the hands-on configuration labs (BGP, NAT, GRE, VRRP, DHCP, VLAN, EtherChannel, etc.) run on the free open-source **VyOS Universal Router** appliance from the [GNS3 marketplace](https://gns3.com/marketplace/appliances/vyos-universal-router). To use them:

1. Register the VyOS appliance on your GNS3 server and note its `template_id`.
2. Set `GNS3_VYOS_TEMPLATE=<that-uuid>` in `.env`. If unset, the seeder stores a placeholder and the VyOS topologies will fail to instantiate until you set it.
3. VyOS console login defaults to `vyos`/`vyos`; override with `GNS3_NODE_USER` / `GNS3_NODE_PASS` if you hardened the image. The grader (`gradingService.js`) auto-logs-in when it sees a getty prompt.

Example VyOS CLI in the lab hints targets **VyOS 1.4+/1.5** syntax. Grading deliberately favors **functional outcomes** (`ping`, learned routes, NAT translations, interface `u/u`) over exact config strings so checks survive VyOS version syntax drift.

## Architecture

ESM Express app (`"type": "module"` — use `import`, not `require`) doing server-rendered Nunjucks pages. The product is a Thai-language networking-course platform where each lab provisions a live GNS3 topology on demand and grades it automatically.

**Entry point** `src/server.js`: configures Nunjucks (views in `src/views`, `.njk`; filters: `markdown`, `thaidate`), session middleware, static `src/public`, mounts `/auth`, `/courses`, `/learn`, `/lab`, `/dashboard`. A global middleware exposes `req.session.user` to every template as `res.locals.user`. `/dashboard` (the post-login landing page) aggregates the user's `Progress` docs into continue-learning cards, study stats, recent activity, and not-yet-started course suggestions.

**Auth** is session-based (`express-session`), not JWT. Sessions are stored in MongoDB via `connect-mongo` (they survive restarts); cookies are `sameSite: 'lax'` and `secure` in production. `SESSION_SECRET` is required in production — `server.js` throws at startup without it. `requireAuth` (`src/middleware/requireAuth.js`) gates routes by checking `req.session.user` and redirects to `/auth/login`, remembering the blocked GET URL in `session.returnTo` so login lands the user back there (also settable via `/auth/login?next=/...`, same-site paths only). The course catalog (`/courses`, `/courses/:id`) is **public** — progress only renders when logged in; `/learn` and `/lab` stay auth-gated. Passwords are hashed via a `User` pre-save hook (bcrypt); never set `password` to a plaintext value expecting it to be re-hashed unless it changed (the hook checks `isModified`). `authRoutes` coerces credential fields to plain strings before they reach Mongo (blocks `email[$gt]=`-style operator injection) and validates username/email/password shape server-side.

**Logging & errors** (`src/config/logger.js` + `src/server.js`): `pino` — JSON in production, `pino-pretty` in dev; request logging via `pino-http` (static assets ignored; in routes use `req.log`, elsewhere import the logger — never `console.*`). `express-async-errors` is imported at the top of `server.js` so async route errors reach the global error handler (GET → Thai `error.njk` page, others → JSON) instead of crashing the process; unknown routes get a Thai 404. `SIGINT`/`SIGTERM` trigger graceful shutdown (close server → disconnect Mongo) — lab sessions persist in MongoDB so restarts lose nothing.

**GNS3 multi-tenancy proxy** (`src/middleware/gns3Proxy.js`): the GNS3 Web-UI/API has **no per-user authorization** — anyone who reaches it can list/open/delete every project. So the browser never talks to GNS3 directly: the lab iframe loads the Web-UI through our origin at GNS3's canonical `/static/web-ui/bundled` entry (the default `webUiUrl` when `GNS3_PUBLIC_URL` is unset — that route bootstraps a "local server" from the page origin, so all its `/v2` calls come back to us; the web-ui is path-routed, so deep-linking a project isn't possible without the client-generated server uuid — the user lands on their project list, filtered to one). The proxied `/v2/...` REST + WebSocket calls are authorized against the caller's own `LabSession.projectId`: any `/v2/projects/<id>/...` must be their own project; `/v2/projects` list is filtered to just theirs; creating a project and all other non-project mutations are 403; read-only global GETs (version/computes/templates/symbols — server config, not user data) pass so the Web-UI works. A user can still only spawn nodes inside their own project. Server-side GNS3 basic-auth is injected by the proxy so credentials never reach the browser. The gate is mounted **before** helmet and the body parsers (so the Web-UI keeps its inline scripts and request bodies stream through); WebSocket upgrades are authorized in `server.on('upgrade')`. In production GNS3 can stay on a private network entirely. Setting `GNS3_PUBLIC_URL` opts back into direct browser→GNS3 mode (then CSP `frame-src` must include that origin).

**Security middleware** (`src/server.js`): `helmet` with a custom CSP — `style-src` needs `'unsafe-inline'` (the DSD renderer injects inline `<style>` into every shadow template) and `frame-src` includes `'self'` (the proxied Web-UI iframe) plus the GNS3 origin (direct mode); `upgrade-insecure-requests` is disabled so the http GNS3 iframe works in dev. A lightweight CSRF guard rejects non-GET requests whose `Origin`/`Referer` doesn't match our own origin (requests with neither header pass — `sameSite: 'lax'` covers them). Rate limits (`express-rate-limit`, in-memory per instance): 20/15 min per IP on login+register (shared window), 10/10 min per user on lab start.

**Data model** (`src/models/Course.js`): a `Course` embeds an array of `labs`; each lab embeds its full GNS3 `topology` (`nodes` + `links`), `objectives`, `hints`, and `gradingChecks`. There is no separate Lab collection — labs are addressed by array index (`/lab/:courseId/:labIndex`). A grading check is `{ description, node, command, expect, points }` where `expect` is a **regex string** matched case-insensitively against console output.

### The lab lifecycle (the core flow)

This is the part that requires reading several files together. Lab sessions are persisted in the `LabSession` collection (`src/models/LabSession.js` — one doc per user, unique index) and managed by `src/services/labSessionService.js`, so they survive restarts; all cost-control logic (start lock, heartbeat, sweeping) lives in that service.

1. `POST /lab/:courseId/:m/:l/start` → `labSessionService.startSession()` **atomically claims** the user's slot (`status: 'building'` doubles as a start lock — a concurrent start gets a 409 `LabBusyError`; a stale build is reclaimable after 5 min). A **global admission cap** (`LAB_MAX_CONCURRENT`, default 10, `0` = unlimited) is checked after the claim: a net-new session that pushes the count past the cap releases its slot and gets a 503 `LabCapacityError` (rebuilding an existing session never increases the count, so it is always admitted). It then tears down the user's previous project, and `gns3Service.buildLab()` creates the project/nodes/links and starts all nodes. `buildLab` deletes its own half-built project if it fails partway. The doc then stores `{ projectId, webUiUrl, nodes }` with `status: 'ready'`.
2. The browser embeds `webUiUrl` (the GNS3 Web-UI) in an iframe — the user interacts with real devices directly in GNS3, **not** through a custom terminal.
3. `GET /lab/:courseId/:m/:l/status` is both **heartbeat and boot probe**: every hit bumps `lastActivityAt`; for the matching ready session it telnet-probes node consoles that haven't answered yet (`gradingService.probeNode` — a QEMU console accepts TCP long before the OS boots, so it waits for a getty/CLI prompt) and caches them in `bootedNodes`. The lab page (`png-lab.js`) polls every 5s until `allBooted` (the grade button stays disabled until then — VyOS takes 1–2 min to boot), then drops to a 60s heartbeat; on page reload it **resumes** the running session instead of rebuilding.
4. `POST /lab/:courseId/:m/:l/grade` → first verifies the active session matches this exact course/module/lesson (409 otherwise — node names like `R1`/`PC1` repeat across labs, so cross-lab grading would falsely pass), then `gradingService.runChecks(session.nodes, lab.gradingChecks)`. Checks are grouped per node: **one telnet session per node** (raw TCP socket; auto-login at a getty prompt — VyOS `vyos`/`vyos`; CLI prompt `/[>#$]\s*$/` — note `$` for VyOS op mode), that node's commands run sequentially with pager auto-advance (`--More--`/`(END)`), and node groups run in parallel. Output is tested against the `expect` regex; results keep the original check order.
5. `POST /lab/stop` → deletes the GNS3 project and the session doc. In addition, `startSweeper()` (called from `server.js`) runs at startup and every 5 min: it tears down sessions idle longer than `LAB_IDLE_MINUTES` (default 45 — the page heartbeat keeps an open tab alive) and deletes **orphaned** `pingable_*` GNS3 projects that no session references (project names embed a ms timestamp — `pingable_<ms>_<title>` — and projects younger than 10 min are spared since their build may still be in flight). This is what stops cloud cost — labs are meant to be ephemeral.

`src/services/gns3Service.js` wraps the GNS3 REST API (`/v2`). Things to preserve when touching it:
- `createProject` sets `auto_close: false` — otherwise GNS3 powers off the whole project (invalidating console ports) the moment the Web-UI's notification socket disconnects, i.e. whenever the user closes the lab tab. Lifetime is governed by our stop button / sweeper instead.
- `buildLab` rewrites a `console_host` of `0.0.0.0` to the GNS3 server hostname so the grader can actually connect.
- A node with a `templateId` is instantiated via `POST /projects/{id}/templates/{templateId}` (then renamed), **not** through `POST /nodes` — appliances cannot be created the latter way. For those template/qemu nodes a link `port` maps to **adapter N, port 0** (VyOS `ethN`); built-in `vpcs`/`ethernet_switch` nodes use **adapter 0, port N**.

`src/services/gradingService.js` strips ANSI codes; timeouts: 25s connect+login per node, 20s per command, 4s per boot probe.

### Adding lab content

New topologies/checks go into the embedded `topology.nodes` / `topology.links` / `gradingChecks` of a lab (see `scripts/seed.js` for the canonical shape). GNS3 `nodeType` values in use: `vpcs`, `ethernet_switch`, or a `templateId` (UUID) for router/appliance images. For VyOS-based config labs use the factories in `scripts/seed-data/_vyos.js` (`vyos()`, `pc()`, `sw()`) — `vyos()` injects the `GNS3_VYOS_TEMPLATE` id and a link `port` value equals the VyOS interface number (port 1 → `eth1`). The CCNP Core / Advanced Routing courses carry 20 VyOS hands-on labs across their lab modules. User-facing strings are Thai; keep that convention in views and seed data.
