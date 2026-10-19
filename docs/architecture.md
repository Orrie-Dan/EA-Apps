# Architecture: how the system was conceived and built

This document explains what the system is for, how its pieces fit together, and
why it is built the way it is. For day-to-day tasks see
[operations.md](operations.md). For health checks and alerts see
[monitoring.md](monitoring.md).

## 1. The problem it solves

Each government sector (health, agriculture, environment, …) wanted one branded
web portal that collects the ArcGIS dashboards, Experience Builder apps and
Survey123 forms relevant to it. The content already existed on GeoHub
(`gh.space.gov.rw`) and on partner portals run by individual institutions.

The original apps came from separate source drops (the `*.zip` files in the
workspace root). They hard-coded item IDs and texts, signed users in from the
browser, and framed portal pages directly. That caused three recurring problems:

1. **Every content change needed a rebuild and redeploy.** Typical changes were a
   new dashboard, a renamed menu or a replaced item ID.
2. **Sign-in was repeated or broken.** Users signed into the app, then again
   inside each framed dashboard, and partner portals needed separate accounts.
3. **There was no visibility.** When a partner certificate expired or an item
   was unshared, users saw a spinner or "Unable to connect", and nobody knew why.

The design goals that followed:

- **Content is data.** Menus, item IDs, texts, images and typography live in one
  central service. Apps fetch them at runtime.
- **One sign-in.** Users sign in once with their own GeoHub account. Dashboards
  on any portal open without a second prompt.
- **No secrets in browsers.** Portal service-account passwords and tokens stay
  on the server.
- **Static deployment.** Each app is plain files on the GeoHub web server under
  `/<app-key>/`, with no per-app backend to run.
- **Observable.** One page shows what is broken, and email says when it changes.

## 2. Components

| Component | Location | Technology | Role |
| --- | --- | --- | --- |
| 13 mapping apps | `EA Apps/*-app` | React 19, Vite, Vitest | The sector portals |
| Shared UI | `EA Apps/packages/ui` (`@ea/ui`) | React components + CSS | One look for all 13 apps ([shared-ui.md](shared-ui.md)) |
| Runtime Config service | `D:\Esri\runtime-config-service` | NestJS 11, Prisma 6, PostgreSQL | Config API, app sign-in, portal proxy, token broker, monitor |
| Runtime Config Admin | `D:\Esri\runtime-config-admin` | React 19, Vite, TypeScript | Admin console: apps, config editor, audit, portal credentials, Status |
| GeoHub portal | `https://gh.space.gov.rw/portal` | ArcGIS Enterprise 2024.1 | Main content and the user identity provider |
| Partner portals | rbc, rdb, wasac, rura, reg, ewis, rmb, moe, infra, esrirw, … | ArcGIS Enterprise / Online | Sector-owned content |

In production, IIS/ARR on `gh.space.gov.rw` serves the app folders as static
files and forwards `/api/*` to the Runtime Config service. The apps, the
service and GeoHub therefore share **one origin**. This matters for cookies and
framing (see §4).

## 3. Runtime Config (content as data)

Each app has a permanent **application key** (e.g. `health-mapping`) and one
JSON document in the service database (`Application.config`). The document
format is the harmonized V1 contract (HARM-01, see
[runtime-config-harmonized-contract.md](runtime-config-harmonized-contract.md)):

- `app`, `organization`, `contact`, `footer`, `legal` hold texts and legal pages
- `branding` holds the logo, favicon and `typography`
- `modules[].apps[]` is the sidebar. Each entry has a `kind` (`dashboard`,
  `experience`, `survey123`, `external`, `localShell`), a `portalItemId`, and a
  `portalHostKey` naming which portal the item lives on (`gh`, `gh2`, `rbc`,
  `rdb`, `wasac`, …).
- `extensions.<topic>` holds app-specific opaque data

On start-up an app calls `GET /api/v1/config/<app-key>` and merges the result
over its **bundled defaults**, so a backend outage still shows a working shell
(see [runtime-config-consumer-pattern.md](runtime-config-consumer-pattern.md)).
Admins edit the document in the Admin console. Every change writes an
append-only audit row in the same transaction.

The shared typography is configured the same way. The `shared-theme`
application row holds the defaults, and each app may override them (see
[typography.md](typography.md)).

Runtime Config holds **no secrets**. Portal URLs per host key, CORS origins and
credentials are deployment configuration (environment variables or the
encrypted `PortalCredential` table).

## 4. Sign-in and portal access

### 4.1 Production (static build)

```
1. User opens https://gh.space.gov.rw/<app-key>/  → static index.html + JS
2. App: GET /api/v1/app-auth/session?appKey=…      → 401 → shows login page
3. User enters GeoHub username/password
   App: POST /api/v1/app-auth/login {appKey, username, password}
   Service: checks Origin is allowed, app is active
            verifies the credentials against GeoHub (generateToken), discards the token
            sets HttpOnly cookie rc_app_session_<appKey> (JWT, 8 h, SameSite=Lax, Path=/api/v1/)
4. User picks a dashboard. App frames
   /api/v1/portal-proxy/<appKey>/<hostKey>/portal/apps/dashboards/<itemId>
   Service: verifies the session cookie for that app
            refuses a foreign Origin, refuses admin/sign-in/edit operations
            gets a service-account token for <hostKey> from the broker (cached)
            fetches the portal URL with the token, rewrites portal URLs in
            the response back to the proxy (absolute URLs stay absolute on
            the app origin, so IdentityManager can match a server's
            owningSystemUrl to its portal), scrubs the token from body
            and Location headers
```

Why it works this way:

- **The user's own account proves who they are.** The service account only
  *reads* content on the user's behalf. Viewing is gated by a valid GeoHub
  login, and the proxy blocks writes, sharing changes and admin paths
  (`BLOCKED_PATH` in `portal-proxy.rewrite.ts`).
- **One sign-in covers every portal.** The service holds a credential per
  partner host, so the user never sees partner sign-in pages.
- **Tokens never reach the browser.** The cookie is HttpOnly, and tokens are
  attached and scrubbed server-side.
- **There is one cookie per app** (`rc_app_session_<appKey>`). With a single
  shared cookie, signing into one app signed you out of the others.
- **The proxy sits under the service**, not under the app folder. A path like
  `/<app-key>/api/...` on a static host falls back to `index.html`, so an
  earlier version framed the app inside itself, recursively.

The **token broker** (`POST /api/v1/portal-auth/token`, `PortalAuthTokenService`)
issues a short-lived token for an `(appKey, portalHostKey)` pair. It only does
so when that app's config references that host and an active credential
exists. Tokens are cached until 60 s before expiry and bound to the requesting
origin as referer.

**Survey123 forms** are framed through the proxy as well, under the reserved
host key `s123` (survey123.arcgis.com, no token, GET/HEAD only). Their
`portalUrl` points at the form host's proxy, so the form loads with that host's
service account and no second sign-in. They are view-only: submissions are
blocked. A form's `portalHostKey` must name a credential the form is shared
with (RBC forms use `rbc1`). **StoryMaps** are framed
directly and never proxied, because the StoryMaps router only accepts its own
paths (see `storymap-links.*`).

### 4.2 Local development (dev proxy)

`npm run dev` runs each app's own server middleware inside Vite
(`server/vite-plugin.js` → `server/access-server.js`). It reproduces the same
model locally: `/api/auth/login`, an `*_app_gate` cookie, and
`/<app-key>/api/portal/proxy/<host>/…` routes that fetch broker tokens from
the local service. This path predates the static build and stays for
development. The two paths are selected at build time by `STATIC_BUILD`
(`src/config/deployMode.js`, set by `vite build --mode static`). Dead-code
elimination drops the unused path from the bundle.

Notable dev-proxy fixes, each kept as a separate module so they are easy to
find:

| Module | What it fixes |
| --- | --- |
| `server/portal-token-renewal.js` | Renews expired broker tokens on the fly. Before this fix, Dashboards retried with a stale token roughly every 30 ms forever. |
| `server/portal-refusal.js` | Rewrites portal "403 in a 200 body" to 400. The ArcGIS IdentityManager treats 403 as "needs credentials" and retries forever. |
| `server/base-path.js` | Serves everything under `/<app-key>/` (see [base-path.md](base-path.md)) |
| `server/storymap-links.js` | Leaves StoryMap URLs unrewritten |
| `server/portal-fetch.js` (health) | Pinned exception for the expired RBC certificate |

The `:authority`/`:scheme` handling in `access-server.js` exists because Vite
serves HTTP/2 when TLS certificates exist. HTTP/2 has no `Host` header, and
without that handling tokens were bound to the wrong referer.

### 4.3 Security decisions on record

- The app gate is set **only** by a successful login. An earlier version let an
  empty `POST /api/auth/ui-session` open it.
- Proxy writes are refused unless the request Origin equals the signed-in
  origin. Combined with `SameSite=Lax`, this stops cross-site use.
- TLS verification is never turned off globally. The single exception is a
  **pinned** one for `gis.rbc.gov.rw` (`portal-fetch.ts`). It accepts only
  `CERT_HAS_EXPIRED` for one exact SHA-256 fingerprint, until 2026-11-15, and
  uses `maxCachedSessions: 0` because resumed TLS sessions carry no peer
  certificate. Remove it once RBC renews.

## 5. Performance

Dashboards load roughly 7 MB of JavaScript and CSS. The service proxy
(`portal-proxy.cache.ts`):

- passes long cache lifetimes for static portal files under `/apps/`, `/jsapi/`
  and `/sharing/files/` (`immutable` for hashed names, 1 h otherwise)
- compresses text responses of 1 KB and up (brotli, else gzip)
- keeps rewritten static files in a memory LRU per app and host
  (`PORTAL_PROXY_CACHE_MB`, default 64). This cache is checked only **after**
  the session check.

Data responses stay `private, no-store`. Measured on one heavy dashboard,
static transfer fell from 11.6 MB on every open to about 0 MB on a repeat
visit. The remaining slowness is GeoHub feature queries themselves.

## 6. App families

The 13 apps descend from three code lineages. A fix in one usually needs porting
to its siblings.

| Family | Apps | Recognise it by |
| --- | --- | --- |
| **env** | agriculture, environment, mining, water, parks | `src/auth/AuthContext.jsx`, `server/index.js` (`npm start`), `UPSTREAMS` table in `access-server.js`, mkcert `.certs/` |
| **pop** | population, trade, land, local-government, education | `AuthProvider.jsx` + `server/embed-proxy.js` + `server/auth-core.js` |
| **infra** | infrastructure, health, disaster | `AuthProvider.jsx` with all proxying in `server/access-server.js` (no `embed-proxy.js`); portal mirrors (health `rbc-proxy`, infra `wasac-proxy`/`portal-mirror`) |

The pop and infra families both patch framed dashboards with
`public/dashboards/ssl-patch.js`.

The families differ in server and auth code only. Since 2026-10-14 every app
draws its screens from `packages/ui` through its `src/shell.jsx` adapter
([shared-ui.md](shared-ui.md)).

Common to all of them: `src/config/` (Runtime Config loader, `applyTypography.js`,
`deployMode.js`, `runtimeConfigUrl.js`), `src/auth/runtimeSessionAuth.js`
(static sign-in), and the server modules in §4.2.

**Host keys** must be supported in code before config can use them. When the
live config gave an app an item on a host its code did not know (`gh2` for
health and agriculture, `infra` for education), the app returned 400
"Unsupported portalHostKey". Apps without `gh2` support: population, trade,
land, local-government, disaster, mining, water, parks, education.

## 7. How it was built (timeline)

| Date (2026) | Step |
| --- | --- |
| Sep 15–19 | Apps rebuilt from source drops. Runtime Config service + HARM-01 contract, admin auth, audit log, encrypted portal credentials, token broker. |
| Oct 10 | Hang investigation across all apps: HTTP/2 referer bug, token-expiry retry storms, HSTS stripping, moe embed URLs. |
| Oct 11 | App-gate security fix. All apps served under `/<app-key>/`. Retry-storm guard. Backend moved behind IIS. |
| Oct 12 | Static-build mode. Service-side app sign-in + portal proxy (option A), per-app session cookies. Ported to all 12 apps. |
| Oct 13 | Education app built from the population template. Shared typography + `typography.css`. Pinned RBC certificate exception. gh2/moe/infra hosts. Proxy caching and compression. StoryMaps framed directly. |
| Oct 14 | Status monitor + email alerts in the service, Status page in the admin console. Monorepo baseline commit. All 13 apps moved onto the shared UI package `packages/ui` (Infrastructure look); Tailwind removed from the env family. |

Before each change, file copies were saved under `_backup/<date>-<topic>/`. That folder now lives in `EA Apps archive/` (see the README).

## 8. Known limits and open items

- **Portal-side content problems** can only be fixed by the item owners, e.g.
  items refused even to the org admin (GWM_0003) or deleted (CONT_0001). The
  Status page lists them.
- **Partner portals the server cannot reach** need a network fix on the
  `gh.space.gov.rw` server. EWIS has shown this before, and so did GeoHub from
  `gis.mcg.rw`.
- **Same-origin limits.** Separate static apps on gh with their own OAuth
  (`/crop-health/`, `/water-quality/`) send `X-Frame-Options: SAMEORIGIN`. They
  frame only on the deployed host and ask for a second sign-in there.
- **The dev proxies** (as opposed to the service proxy) are still uncompressed
  and `no-store`.
- **Education** reuses population's dev cookie names, so on `localhost` the two
  share a dev session.
- **Health and partner certificates.** `gis.rbc.gov.rw` has an expired
  certificate (exception above), and `arcgis.rura.rw` expires 2026-10-16.
