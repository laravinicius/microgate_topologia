# AGENTS.md

InfraMap: network-infrastructure map for companies/floors/tables/racks, multi-tenant, QR labels. Backend Node/Express + MySQL, frontend React/Vite. UI text and code comments are pt-BR.

## Commands

- Backend dev: `npm run dev` (node --watch server.js) · start: `npm start`
- Frontend dev: `npm run dev:frontend` (Vite, port 5173) · build: `npm run build` → `frontend/dist/`
- **No test, lint, or typecheck exist.** `npm test` is a stub that exits 1. Verify by running the app and hitting the endpoint manually.
- Prod runs under PM2 via `ecosystem.config.js` (name `topologia-server`, port 3005, cwd `/var/www/topologia`).

## Port / environment reality

- `.env` and PM2 set `PORT=3005` (prod). `server.js` defaults to `3001`.
- Vite dev proxy (`frontend/vite.config.js`) targets `http://localhost:3001`. So for a working dev backend, run it on 3001 (`PORT=3001 npm run dev`). `.env`'s 3005 is only for the PM2 prod run.
- CORS allowlist is hardcoded in `server.js` (`topologia.microgateinformatica.com.br`, localhost 3001/5173). Adding a host means editing that array.
- `frontend/dist/` is served by the backend only when `NODE_ENV=production`.

## Backend architecture (`server.js`, single ~1300-line file)

- Every route lives in `server.js`. No route/module splitting. Auth: JWT (24h) verified from `Authorization: Bearer` **or** `?token=` query param.
- Middleware order: `requireAuth` → `requireAdmin` (checks JWT `isAdmin` flag, NOT username) → `requireEmpresa` → `requireAndar`. The last two are *stateless*: they read `empresaId`/`andarId` from the JWT payload, not a server session. JWT also carries `isAdmin`; `/api/auth/login`, `/api/auth/me`, `/api/auth/session-info` and the select-* re-signs propagate it.
- Two profiles: `admin` (`users.is_admin=1`, sees/manages everything) and `visualizador` (`is_admin=0`, read-only). Viewer's company access is limited by `user_empresas` join table (migration `007`): `GET /api/empresas` filters, and `select-company` rejects companies not assigned to the viewer (403). All write routes (`POST/PUT/DELETE` empresas/andares/racks/mesas/map-elements, `PUT /api/data`, `PUT /api/ponto/toggle-atencao`, QR routes) are `requireAdmin`; viewer gets only GET reads to render the map.
- Selecting company/floor re-signs the token carrying the new context (`/api/auth/select-company`, `/api/auth/select-andar`). Frontend stores token in sessionStorage key `inframap-auth-token` (setToken also clears any stale localStorage copy); any 401 response clears it and reloads the page.
- Live updates via SSE: `/api/sse` (requires auth), `broadcastSSE()` + `sseClients` set; writes in `PUT /api/...` handlers call it.
- Public (unauthenticated) map viewer: `/api/public/*` routes plus `/api/qrcode/mesa/:mesaId`. Company slug = company name, queried case-insensitively.

## Frontend (`frontend/src`)

- No routing library in use despite `react-router-dom` being a dependency. Path handling is manual: `App.jsx` `PublicRouteDetector` inspects `window.location.pathname`; a bare `/slug` (non-reserved) renders `PublicMapViewer` unauthenticated. Don't "fix" routing to react-router.
- `CompanyDashboard.jsx` is the main authenticated UI. Layout constants and overlap-check helpers live at the top of `App.jsx` (shared with MapEditor via props, not a module).
- Auth/session state via `frontend/src/context/AuthContext.jsx`; sessionStorage keys `showCompanySelection`/`showAndarSelection` force re-selection.

## Database

- Migrations are **incremental only** (`database/migrations/001`–`007`). Base tables (`users`, `mesas`, `racks`, `patch_panels`, `mesa_pontos`) are **not** created by any migration — a fresh database will not self-bootstrap. Apply in order manually:
  `mysql inframap < database/migrations/NNN_*.sql`
- No migration creates the `users` table or seeds the `admin` account; that happens out-of-band. If schema changes, update server.js queries too.
- `db.js` is a plain `mysql2/promise` pool; queries are inline SQL in `server.js`, no ORM.

## Gotchas

- `server.js:1066` hardcodes the prod domain in generated QR URLs (`https://topologia.microgateinformatica.com.br/...`). Dev QR codes point at prod.
- **QR codes already printed are frozen contracts.** Every generated QR embeds `https://topologia.microgateinformatica.com.br/{empresaNome}?mesa={mesaId}&andar={andarId}` (server.js:1066). Restructuring must keep `/slug?mesa=&andar=` resolving, `findEmpresaBySlug` matching, and mesa IDs stable/stable-mapped. Never change the QR payload or rename/re-purpose mesa IDs.
- `img/` is served at `/img`; the repo root is also `express.static`'d.
- `canvas` is a native module — requires build toolchain; `node_modules` for backend and frontend are separate (install both).