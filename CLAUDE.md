# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run with nodemon (auto-reload) at http://localhost:3000
- `npm start` — run once with plain node
- `npm run seed` — wipe the `courses` collection and re-insert the demo courses from `scripts/seed.js`

There is no test runner, linter, or build step configured.

## Prerequisites for local development

The app talks to two external services; both must be running or the relevant features fail:

- **MongoDB** at `mongodb://localhost:27017/pingable-dev` (override with `MONGODB_URI`). The process calls `process.exit(1)` if it cannot connect on startup.
- **GNS3 server** at `http://localhost:3080` (override with `GNS3_HOST` / `GNS3_PORT`). Required only when starting/grading a lab, not for browsing courses.

Config is read from `.env` (gitignored; no `.env.example` exists). Variables used in code: `PORT`, `NODE_ENV`, `SESSION_SECRET`, `MONGODB_URI`, `GNS3_HOST`, `GNS3_PORT`, `GNS3_USER`, `GNS3_PASS`, `GNS3_VYOS_TEMPLATE`, `GNS3_NODE_USER`, `GNS3_NODE_PASS`.

### VyOS appliance for configuration labs

We cannot ship licensed Cisco IOS, so the hands-on configuration labs (BGP, NAT, GRE, VRRP, DHCP, VLAN, EtherChannel, etc.) run on the free open-source **VyOS Universal Router** appliance from the [GNS3 marketplace](https://gns3.com/marketplace/appliances/vyos-universal-router). To use them:

1. Register the VyOS appliance on your GNS3 server and note its `template_id`.
2. Set `GNS3_VYOS_TEMPLATE=<that-uuid>` in `.env`. If unset, the seeder stores a placeholder and the VyOS topologies will fail to instantiate until you set it.
3. VyOS console login defaults to `vyos`/`vyos`; override with `GNS3_NODE_USER` / `GNS3_NODE_PASS` if you hardened the image. The grader (`gradingService.js`) auto-logs-in when it sees a getty prompt.

Example VyOS CLI in the lab hints targets **VyOS 1.4+/1.5** syntax. Grading deliberately favors **functional outcomes** (`ping`, learned routes, NAT translations, interface `u/u`) over exact config strings so checks survive VyOS version syntax drift.

## Architecture

ESM Express app (`"type": "module"` — use `import`, not `require`) doing server-rendered Nunjucks pages. The product is a Thai-language networking-course platform where each lab provisions a live GNS3 topology on demand and grades it automatically.

**Entry point** `src/server.js`: configures Nunjucks (views in `src/views`, `.njk`), session middleware, static `src/public`, mounts `/auth`, `/courses`, `/lab`. A global middleware exposes `req.session.user` to every template as `res.locals.user`.

**Auth** is session-based (`express-session`), not JWT — despite `jsonwebtoken` being a dependency, it is currently unused. `requireAuth` (`src/middleware/requireAuth.js`) gates routes by checking `req.session.user` and redirects to `/auth/login`. Passwords are hashed via a `User` pre-save hook (bcrypt); never set `password` to a plaintext value expecting it to be re-hashed unless it changed (the hook checks `isModified`).

**Data model** (`src/models/Course.js`): a `Course` embeds an array of `labs`; each lab embeds its full GNS3 `topology` (`nodes` + `links`), `objectives`, `hints`, and `gradingChecks`. There is no separate Lab collection — labs are addressed by array index (`/lab/:courseId/:labIndex`). A grading check is `{ description, node, command, expect, points }` where `expect` is a **regex string** matched case-insensitively against console output.

### The lab lifecycle (the core flow)

This is the part that requires reading several files together. `src/routes/labRoutes.js` keeps an **in-memory `activeSessions` Map** (`userId -> { projectId, webUiUrl, nodes }`). This is process-local and non-persistent — it does not survive a restart and will not work across multiple server instances.

1. `POST /lab/:courseId/:labIndex/start` → `gns3Service.buildLab(lab, lab.title)` creates a GNS3 project, creates each node, wires links, starts all nodes, and returns `{ projectId, webUiUrl, nodes }`. Any prior session for the same user is torn down first. The result (including the `nodes` console map) is stored in `activeSessions`.
2. The browser embeds `webUiUrl` (the GNS3 Web-UI) in an iframe — the user interacts with real devices directly in GNS3, **not** through a custom terminal.
3. `POST /lab/:courseId/:labIndex/grade` → `gradingService.runChecks(session.nodes, lab.gradingChecks)`. For each check it opens a **raw TCP telnet socket** to the node's console host/port, optionally **logs in** if a getty prompt appears (VyOS `vyos`/`vyos`), waits for a CLI prompt (`/[>#$]\s*$/` — note `$` for VyOS op mode), sends `command`, auto-advances any pager (`--More--`/`(END)`), collects output, and tests it against the `expect` regex. Returns `{ score, total, results }`.
4. `POST /lab/stop` → `gns3Service.deleteProject(projectId)` and removes the session. This is what stops cloud cost — labs are meant to be ephemeral.

`src/services/gns3Service.js` wraps the GNS3 REST API (`/v2`). Two things to preserve when touching it:
- `buildLab` rewrites a `console_host` of `0.0.0.0` to the GNS3 server hostname so the grader can actually connect.
- A node with a `templateId` is instantiated via `POST /projects/{id}/templates/{templateId}` (then renamed), **not** through `POST /nodes` — appliances cannot be created the latter way. For those template/qemu nodes a link `port` maps to **adapter N, port 0** (VyOS `ethN`); built-in `vpcs`/`ethernet_switch` nodes use **adapter 0, port N**.

`src/services/gradingService.js` strips ANSI codes and enforces a single 20s timeout covering connect + login + prompt + command output.

### Adding lab content

New topologies/checks go into the embedded `topology.nodes` / `topology.links` / `gradingChecks` of a lab (see `scripts/seed.js` for the canonical shape). GNS3 `nodeType` values in use: `vpcs`, `ethernet_switch`, or a `templateId` (UUID) for router/appliance images. For VyOS-based config labs use the factories in `scripts/seed-data/_vyos.js` (`vyos()`, `pc()`, `sw()`) — `vyos()` injects the `GNS3_VYOS_TEMPLATE` id and a link `port` value equals the VyOS interface number (port 1 → `eth1`). The CCNP Core / Advanced Routing courses carry 20 VyOS hands-on labs across their lab modules. User-facing strings are Thai; keep that convention in views and seed data.
