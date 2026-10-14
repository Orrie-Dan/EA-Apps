# Operations: run, deploy, change content, troubleshoot

How the system is used day to day. For background, read
[architecture.md](architecture.md) first. For health checks, see
[monitoring.md](monitoring.md).

## 1. Local development

### Prerequisites

- Node.js 20+
- PostgreSQL, for the Runtime Config service
- [mkcert](https://github.com/FiloSottile/mkcert), with `mkcert -install` run
  once. Experience Builder forces `https` and needs a trusted certificate for
  its service worker.

### Backend

```bash
cd D:/Esri/runtime-config-service
cp .env.example .env            # fill DATABASE_URL, JWT_SECRET, PORTAL_CREDENTIAL_ENCRYPTION_KEY, ALLOWED_ORIGINS
npm install
npm run prisma:generate && npm run prisma:migrate:deploy && npm run prisma:seed
npm run admin:create -- --email you@example.com
npm run start:dev               # http://localhost:3000, Swagger at /api/docs
```

`ALLOWED_ORIGINS` must contain every app origin you open, both the `http` and
`https` forms of `localhost:<port>`. A missing origin shows up as broker 400
"Origin is not allowed".

### Admin console

```bash
cd D:/Esri/runtime-config-admin
npm install && npm run dev
```

Sign in with the admin account created above. Then add **Portal credentials**
(one per host key: `gh`, `gh2`, `rbc`, `rdb`, …) so the broker can issue
tokens.

### An app

```bash
cd "C:/Users/user/Downloads/EA Apps/<app-folder>"
cp .env.example .env            # RUNTIME_CONFIG_PROXY_TARGET=http://localhost:3000 (or https://gh.space.gov.rw)
npm install
npm run dev                     # https://localhost:<port>/<app-key>/
```

- Restart the dev server after any `.env` change. Vite reads it at start-up.
- The env-family apps need mkcert certificates. `npm run cert` creates them in
  `.certs/`.
- After switching `http`↔`https`, **sign out and in again**. Portal tokens are
  bound to the exact origin, scheme included, so an old session returns 401/498
  while the shell still looks signed in.
- Running all 13 dev servers plus a browser takes most of 8 GB of RAM.
  Transient hangs on a full machine are usually memory pressure, not bugs.
  Start only the apps you need.

### Tests and checks

| Where | Commands |
| --- | --- |
| Each app | `npm test`, `npm run lint` |
| Service | `npm test`, `npm run test:e2e`, `npm run lint`, `npx tsc --noEmit`, `npm run build` |
| Admin | `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` |

## 2. Building and deploying

### Apps (static files on gh.space.gov.rw)

```bash
npm run build:static            # → dist/
```

Upload the contents of `dist/` to the gh web server folder named **exactly** the
application key, e.g. `…/wwwroot/health-mapping/`. The bundle requests assets
from `/<app-key>/assets/…`, so a differently named folder gives a blank page.
That happened to land, mining, water and parks.

The web server must:

- serve `index.html` for unknown paths under `/<app-key>/` (SPA deep links)
- forward `/api/*` to the Runtime Config service (IIS/ARR already does)

`npm run build` (without `:static`) produces the dev-proxy flavour, which needs
the Node/Vite middleware. Do **not** deploy it as static files: login returns
404 or 405.

### Runtime Config service

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy   # includes 20261014120000_add_monitoring
npm run build
npm run start:prod
```

Production environment, in addition to the basics in the service README:

- `ALLOWED_ORIGINS` includes `https://gh.space.gov.rw` (the apps' origin)
- an active `gh` portal credential (`APP_LOGIN_PORTAL_HOST`, default `gh`), which
  is what users sign in against
- a credential for every host key used in any app's config
- monitor and alert variables, see [monitoring.md](monitoring.md)

Check after deploying:

```bash
curl https://gh.space.gov.rw/api/v1/config/health-mapping            # 200 JSON
curl -i https://gh.space.gov.rw/api/v1/app-auth/session?appKey=health-mapping   # 401 = route deployed
curl https://gh.space.gov.rw/api/v1/theme/typography.css             # 200 CSS
```

Then open the admin **Status** page and press **Run now**.

## 3. Changing content (no rebuild)

All of these are done in the Admin console. Each one is audited.

| Task | Where |
| --- | --- |
| Rename an app, change texts, contact, legal pages | Application → Configuration |
| Add, replace or reorder a dashboard | `modules[].apps[]`: set `kind`, `portalItemId`, `portalHostKey` |
| Hide a module | `modules[].hidden: true` |
| Change fonts and sizes for every app | `shared-theme` application → `branding.typography` |
| Turn an app off | Application → `isActive: false` (config 404, sign-in refused) |
| Add a partner portal | Portal credentials → new key + service account, **Test** it |

Changes appear after a full browser refresh.

Before using a new `portalHostKey` in an app's config, check that the app's
code supports that host (see
[architecture.md § App families](architecture.md#6-app-families)). Otherwise the
app answers 400 "Unsupported portalHostKey".

The service account for a host must be able to **read** every item configured
on it. Share the item with that account, or with a group it belongs to.

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Blank page after deploy | Server folder ≠ application key | Rename the folder to the key |
| Login 404/405 on deployed app | Non-static build deployed | `npm run build:static`, re-upload |
| Login 400 "Origin is not allowed" | Origin missing from service `ALLOWED_ORIGINS` | Add it, restart the service |
| "Unable to connect to the mapping portal" / broker 503 | Service cannot reach that portal (network/DNS/cert) | Check the Status page portal + TLS rows; fix on the server side |
| 400 "Unsupported portalHostKey" | Config uses a host key the app's code doesn't know | Port host support from a sibling app ([architecture.md §6](architecture.md#6-app-families)) |
| Dashboard shows a portal error page | Item deleted (CONT_0001) or not shared with the service account (GWM_0003) | Item owner shares it or gives a new item ID; update config |
| Endless spinner, thousands of requests | Retry storm: stale token or a refused item (guards exist; a new code path may bypass them) | Check `portal-token-renewal` / `portal-refusal` are used on that proxy path |
| 401/498 on every proxied call while signed in | Session from another origin or scheme | Sign out and in |
| App frames itself repeatedly | Iframe URL went through `appPath()` | Proxy frame URLs must be absolute (`location.origin + /api/v1/portal-proxy/…`) |
| "Refused to display … in a frame" | Target sends `X-Frame-Options: SAMEORIGIN` | Works only when framed from the same origin (deployed gh) |
| Only the StoryMaps logo shows | StoryMap went through the proxy | StoryMap URLs must stay direct (`storymap-links`) |
| Dashboards slow on every open | Old service build without proxy caching | Deploy the current service |
| ERR_CERT_AUTHORITY_INVALID locally | Self-signed dev certificate | `mkcert -install`, `npm run cert` |

## 5. Backups and history

`EA Apps` is one git repository holding all 13 apps and the docs. The service
and the admin console are separate repositories under `D:\Esri\`. Use branches
and commits for history; don't make file-copy backups.

Older history lives outside the repo in `C:\Users\user\Downloads\EA Apps archive\`:
the pre-git file copies (`_backup/<date>-<topic>/<app>/`), and the former
per-app `.git` folders of the five env-family apps (`nested-git/`). See the
[README](../README.md#other-folders-here).
