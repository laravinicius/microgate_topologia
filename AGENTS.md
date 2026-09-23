# AGENTS.md

InfraMap: network-infrastructure map for companies/floors/tables/racks, multi-tenant, QR labels. Backend Node/Express + MySQL, frontend React/Vite. UI text and code comments are pt-BR.

## Commands

- Full dev: `npm run dev:all` — `docker compose up -d --build` (backend em container) e Vite no host (porta 5173); o backend conecta ao MariaDB configurado no `.env`.
- Backend em container isolado: `docker compose up -d --build` · rebuild só da imagem: `docker compose build app`.
- Backend no host: `npm run dev` (node --watch server.js) · start: `npm start`.
- Frontend dev: `npm run dev:frontend` (Vite, port 5173) · build: `npm run build` → `frontend/dist/`
- **No test, lint, or typecheck exist.** `npm test` is a stub that exits 1. Verify by running the app and hitting the endpoint manually.
- Prod runs under PM2 via `ecosystem.config.js` (name `topologia-server`, port 3005, cwd `/var/www/topologia`).

## Port / environment reality

- `.env` dev seta `PORT=3001` (mesmo default do `server.js`); só o PM2 (prod) usa 3005.
- Vite dev proxy (`frontend/vite.config.js`) targets `http://localhost:3001`. No fluxo docker, esse 3001 é a API no container; no fluxo host, é `PORT=3001 npm run dev`.
- CORS allowlist is hardcoded in `server.js` (`topologia.microgateinformatica.com.br`, localhost 3001/5173). Adding a host means editing that array.
- `frontend/dist/` is served by the backend only when `NODE_ENV=production`.

## Docker (dev only)

- `docker-compose.yml`: serviço `app` (build `Dockerfile`, `npm run dev` = `node --watch` com hot reload); banco MariaDB é externo e configurado pelo `.env`.
- Imagem do `app` usa `node:20-bookworm-slim` + toolchain de build (build-essential, python3, cairo/pango/jpeg/gif/rsvg dev) porque `canvas` e `bcrypt` são módulos nativos. **Primeiro build é lento;** depois fica em cache.
- Compose lê as variáveis de banco do `.env` e define apenas `PORT=3001` para o serviço `app`.
- Bind-mount de `.` em `/app` dá hot reload; volume nomeado `app_node_modules` faz shadow do `node_modules` do host (binários Windows não entram no container). Mudou `package.json`/`package-lock.json`, rode `docker compose build app` (ou `up -d --build`) — recompila nativas dentro do container.
- `docker compose down` para a aplicação e mantém o volume de `node_modules`.
- `docker compose config` valida o compose sem subir.

## Backend architecture (`server.js`, single ~1300-line file)

- Every route lives in `server.js`. No route/module splitting. Auth: JWT (24h) verified from `Authorization: Bearer` **or** `?token=` query param.
- Middleware order: `requireAuth` → `requireAdmin` (checks JWT `isAdmin` flag, NOT username) → `requireEmpresa` → `requireAndar`. The last two are *stateless*: they read `empresaId`/`andarId` from the JWT payload, not a server session. JWT also carries `isAdmin`; `/api/auth/login`, `/api/auth/me`, `/api/auth/session-info` and the select-* re-signs propagate it.
- Two profiles: `admin` (`users.is_admin=1`, sees/manages everything) and `visualizador` (`is_admin=0`, read-only). Viewer's company access is limited by `user_empresas` join table (table in `database/schema.sql`): `GET /api/empresas` filters, and `select-company` rejects companies not assigned to the viewer (403). All write routes (`POST/PUT/DELETE` empresas/andares/racks/mesas/map-elements, `PUT /api/data`, `PUT /api/ponto/toggle-atencao`, QR routes) are `requireAdmin`; viewer gets only GET reads to render the map.
- Selecting company/floor re-signs the token carrying the new context (`/api/auth/select-company`, `/api/auth/select-andar`). Frontend stores token in sessionStorage key `inframap-auth-token` (setToken also clears any stale localStorage copy); any 401 response clears it and reloads the page.
- Live updates via SSE: `/api/sse` (requires auth), `broadcastSSE()` + `sseClients` set; writes in `PUT /api/...` handlers call it.
- Public (unauthenticated) map viewer: `/api/public/*` routes plus `/api/qrcode/mesa/:mesaId`. Company slug = company name, queried case-insensitively.

## Frontend (`frontend/src`)

- No routing library in use despite `react-router-dom` being a dependency. Path handling is manual: `App.jsx` `PublicRouteDetector` inspects `window.location.pathname`; a bare `/slug` (non-reserved) renders `PublicMapViewer` unauthenticated. Don't "fix" routing to react-router.
- `CompanyDashboard.jsx` is the main authenticated UI. Layout constants and overlap-check helpers live at the top of `App.jsx` (shared with MapEditor via props, not a module).
- Auth/session state via `frontend/src/context/AuthContext.jsx`; sessionStorage keys `showCompanySelection`/`showAndarSelection` force re-selection.

## Database

- Single schema in `database/schema.sql` (creates the whole DB: base tables + seeds, idempotent). Run: `mysql inframap < database/schema.sql` — or just `mysql < ...`, the script creates the database itself.
- Seeds: company `WAP` (id 1), floor `3 andar` (id 1), user `admin` (password `admin`, change on first login). `schema.sql` is for new databases; it does not touch existing data.
- `db.js` is a plain `mysql2/promise` pool; queries are inline SQL in `server.js`, no ORM. If schema changes, update server.js queries too.

## Gotchas

- `server.js:1066` hardcodes the prod domain in generated QR URLs (`https://topologia.microgateinformatica.com.br/...`). Dev QR codes point at prod.
- **QR codes already printed are frozen contracts.** Every generated QR embeds `https://topologia.microgateinformatica.com.br/{empresaNome}?mesa={mesaId}&andar={andarId}` (server.js:1066). Restructuring must keep `/slug?mesa=&andar=` resolving, `findEmpresaBySlug` matching, and mesa IDs stable/stable-mapped. Never change the QR payload or rename/re-purpose mesa IDs.
- `img/` is served at `/img`; the repo root is also `express.static`'d.
- `canvas` é um módulo nativo — requer toolchain de build. No docker, o `Dockerfile` já instala a toolchain e compila pra Linux; no host, `node_modules` do backend e do frontend são separados (instalar ambos).
