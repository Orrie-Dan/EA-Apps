# Runtime Config — Standard Consumer Pattern (CLIENT-01)

**Status:** Established by Trade Mapping (`trade-mapping-app`); confirmed by
Population Mapping (`population-mapping-app`) with no consumer-architecture changes.  
**Contract:** HARM-01 Runtime Config V1.  
**Backend:** HARM-02 (accepts harmonized documents).

This document describes the **copyable** integration pattern for the remaining
React 19 + Vite 6 GeoHub workspace apps. Do not create a shared npm package yet;
copy this folder structure and adapt defaults per application.

---

## Application key

| App | Key |
|-----|-----|
| Trade Mapping (pilot) | `trade-mapping` |
| Population Mapping | `population-mapping` |
| Land Administration | `land-administration` |
| Disaster & Emergency | `disaster-emergency-mapping` |
| Health Mapping | `health-mapping` |
| Infrastructure Mapping | `infrastructure-mapping` |
| Education Mapping | `education-mapping` |

Define once:

```js
// src/config/application.js
export const APPLICATION_KEY = 'trade-mapping'
```

Do **not** derive the key from package name, hostname, or display name.

---

## Environment variable

```env
VITE_RUNTIME_CONFIG_URL=https://config.example.gov.rw
```

Consumer fetches:

`GET {VITE_RUNTIME_CONFIG_URL}/api/v1/config/{APPLICATION_KEY}`

- Deployment-owned; never stored inside Runtime Config.
- If unset / blank → use bundled defaults only (no fetch).

Trade Mapping optionally proxies `/api/v1/config` in Vite so HTTPS UI can reach
an HTTP backend without mixed content (`RUNTIME_CONFIG_PROXY_TARGET`).

**Connection proof:** see `docs/runtime-config-application-onboarding.md`.
An app is only **CONNECTED** after Admin change → public GET → browser refresh
shows the new value with consumer `source: remote`.

---

## Folder structure

```text
src/config/
  application.js          # APPLICATION_KEY
  defaults.js             # Bundled HARM-01 document
  types.js                # JSDoc typedefs (optional)
  runtimeConfigUrl.js     # URL builder
  validateRuntimeConfigDocument.js
  resolveRuntimeConfig.js # merge + UI shape + ArcGIS URL compose
  loadRuntimeConfig.js    # fetch + fallback
  RuntimeConfigProvider.jsx
  index.js                # re-exports
  *.test.js               # vitest
```

---

## Defaults

Author `DEFAULT_RUNTIME_CONFIG` from the app’s **existing** content
(`config.js` / `access.js` item IDs). Must match current UX when remote is
unavailable or matches defaults.

Include HARM-01 sections as needed: `app`, `organization`, `contact`, `footer`,
`legal`, `modules[].apps[]` with `kind` + `portalItemId`, optional `branding`,
`extensions`.

---

## Loader

`loadRuntimeConfig()`:

1. Resolve URL from `VITE_RUNTIME_CONFIG_URL` (or options.url).
2. `fetch` with `Accept: application/json`, `cache: 'no-store'`, 10s timeout.
3. On missing URL / network error / non-2xx / bad JSON / failed validation →
   resolve **defaults**, `source: 'defaults'`, set `error` string.
4. On success → merge + resolve, `source: 'remote'`, `error: null`.

No retries, polling, WebSockets, or service workers. Refresh the browser to
pick up Admin changes.

---

## Merge semantics

| Field | Behavior |
|-------|----------|
| `app`, `organization`, `contact`, `branding`, `legal` | Shallow object merge (remote overlays defaults) |
| `modules` | If remote provides an array → **replace** entire array (no index merge) |
| `footer.quickLinks` | If remote provides an array → **replace**; else keep defaults |
| `extensions` | If remote provides an object → **replace**; else keep defaults |
| Unknown top-level keys | Preserved from remote onto the merged document |
| Defaults object | Never mutated |

Then `resolveRuntimeConfig` builds UI helpers (`portal`, `modules` with
`solutions`, `getModule`, `getSolution`, embed URLs, interpolated legal).

---

## Provider / hook

Wrap the app **outside** auth/router (same order as Trade / Education):

```jsx
<RuntimeConfigProvider>
  <AuthProvider>
    <BrowserRouter>…</BrowserRouter>
  </AuthProvider>
</RuntimeConfigProvider>
```

- Starts with resolved defaults; shows boot screen while loading.
- Sets `document.title` from `app.documentTitle` or `app.name`.
- `useRuntimeConfig()` → resolved config.
- `useRuntimeConfigMeta()` → `{ source, error, loading }` (debug only; do not
  show to end users).

Components must not call `fetch` for config themselves.

---

## ArcGIS metadata handling

**In Runtime Config:** `kind`, `portalItemId`, optional `portalHostKey`,
`externalUrl`, `localShellPath`.

**In deployment (`src/lib/access.js`):** `PORTAL_URL`, `PROXY_HOSTS`, local
shell paths under `public/dashboards`, proxy helpers.

Consumer composes:

- `dashboard` → `{PORTAL}/apps/dashboards/{portalItemId}`
- `experience` → `{PORTAL}/apps/experiencebuilder/experience/?id={portalItemId}`

Do **not** store secrets, tokens, or client secrets in Runtime Config.

---

## What remains outside Runtime Config

- `VITE_RUNTIME_CONFIG_URL`
- `PORTAL_URL` / partner portal bases / `PROXY_HOSTS`
- Auth session cookies / GeoHub login
- Vite ports, SSL, Vercel rewrites
- Server proxy credentials

## What must never be Runtime Config

Passwords, JWT/session secrets, OAuth client secrets, portal tokens, DB URLs
with credentials.

---

## Failure behavior

| Condition | Result |
|-----------|--------|
| Remote OK | Remote values (merged) |
| No env URL | Defaults |
| Network / timeout | Defaults |
| 404 / 500 | Defaults |
| Invalid JSON | Defaults |
| Structurally unsafe document | Defaults |
| Partial valid remote | Merge with defaults |

App must never blank out solely because Runtime Config is down.

---

## Population Mapping lesson (APP-02)

Population reused Trade’s consumer files with **no architecture change**.

App-specific only:

- `APPLICATION_KEY = 'population-mapping'`
- Population `defaults.js` (+ `extensions.population-mapping.stagedApps` for orphan `income`)
- `access.js` seeds `APP_SOURCES` from modules **and** stagedApps so local shells /
  server proxy paths for `income` keep working without publishing income in the catalog

Continue copying for Land and later apps. Extract a shared package only after a
third identical copy (or sooner if drift becomes painful).

---

## Steps to copy into the next app (e.g. Land Administration)

1. Copy `src/config/` from Trade or Population Mapping.
2. Set the permanent `APPLICATION_KEY`.
3. Rewrite `defaults.js` from that app’s current `config.js` + `access.js` IDs.
4. Update `access.js`: keep hosts; keep `buildAppSource`; seed `APP_SOURCES` from defaults.
5. Wrap `App.jsx` with `RuntimeConfigProvider`.
6. Replace `from '../data/config'` with `useRuntimeConfig()` in consumers.
7. Leave `data/config.js` as a deprecated compatibility export if needed.
8. Add `VITE_RUNTIME_CONFIG_URL` to `.env.example`.
9. Copy/adapt vitest tests; run `npm test` + `npm run build`.
10. Register the key in Admin with the matching `docs/examples/*.json`.

---

## Manual proof

### Trade Mapping

1. In Runtime Config Admin, create application key `trade-mapping`.
2. Paste config from `docs/examples/trade-mapping.runtime-config.example.json`
   (or Trade’s `src/config/defaults.js` content).
3. Start API; set `VITE_RUNTIME_CONFIG_URL` (or Vite proxy origin).
4. `npm run dev` in `trade-mapping-app` — confirm current branding/catalog.
5. In Admin, change `app.homeTitle` (or `app.name`) to a harmless test string; save.
6. Refresh the browser (no rebuild) — confirm the new title/name.
7. Restore the original value in Admin; refresh again.
8. Stop the API or unset the env URL; refresh — confirm bundled defaults still work.

### Population Mapping

1. Register `population-mapping` in Runtime Config Admin.
2. Load / paste `docs/examples/population-mapping.runtime-config.example.json`
   (or Population’s `src/config/defaults.js` content).
3. Set `VITE_RUNTIME_CONFIG_URL` (or Vite proxy on port 5178).
4. `npm run dev` in `population-mapping-app` — confirm current branding/catalog.
5. Change one harmless visible field (e.g. `app.homeTitle`); save.
6. Refresh the browser (no rebuild/restart) — confirm the new value.
7. Restore the original value; refresh again.
8. Unset the env URL or stop the API — confirm bundled defaults still work.

---

## Reference implementations

- `trade-mapping-app/src/config/` (pilot)
- `population-mapping-app/src/config/` (second copy; same architecture)
