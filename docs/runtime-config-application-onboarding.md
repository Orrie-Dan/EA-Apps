# Runtime Config — Application Onboarding (Existing Apps)

**Purpose:** Turn an existing GeoHub workspace app from **INTEGRATED** into **CONNECTED**.  
**Reference:** Trade Mapping (`trade-mapping-app`) + HARM-01 / consumer pattern.

---

## Connection states (use these words exactly)

| State | Meaning |
|-------|---------|
| **INTEGRATED** | Consumer code exists (`src/config/`, provider, `useRuntimeConfig()`). Unit tests may pass. |
| **REGISTERED** | Application record exists in Runtime Config Admin (`key` + name + active). |
| **POPULATED** | Initial config document exists in the database for that key. |
| **REACHABLE** | Consumer (or curl) can successfully call `GET /api/v1/config/:appKey` against the **same** backend Admin uses. |
| **CONNECTED** | Consumer reports `source: remote`, and an Admin/DB change is visibly proven in the UI after a full browser refresh. |

**Do not call an app CONNECTED merely because consumer code exists.**

---

## Topology checklist (Trade example)

| Component | Local origin |
|-----------|----------------|
| Runtime Config Backend | `http://localhost:3000` |
| Runtime Config Admin | `http://localhost:5173` (`VITE_API_BASE_URL=http://localhost:3000`) |
| Trade Mapping UI | `https://localhost:5179` |
| Trade Runtime Config URL | `VITE_RUNTIME_CONFIG_URL=https://localhost:5179` (same-origin → Vite proxies `/api/v1/config` → backend) |

Admin and Trade must target the **same** Runtime Config service / database.

Prefer same-origin proxy for HTTPS apps talking to an HTTP backend (mixed-content safe).  
If fetching the backend directly, include the Trade origin in backend `ALLOWED_ORIGINS`.

---

## Onboarding workflow (existing application)

### STEP 1 — Integrate Runtime Config consumer

Copy the standard `src/config/` pattern (see `docs/runtime-config-consumer-pattern.md`).  
Wrap the app with `RuntimeConfigProvider`. Migrate UI to `useRuntimeConfig()`.

→ State: **INTEGRATED**

### STEP 2 — Assign permanent APPLICATION_KEY

Example: `trade-mapping` in `src/config/application.js`.  
Never derive from package name or hostname. Key is immutable after Admin create.

### STEP 3 — Authoritative bundled defaults

Build `src/config/defaults.js` from the app’s current content (`config.js` / `access.js` item IDs).  
Defaults must reproduce today’s UX when remote is unavailable.

### STEP 4 — Generate initial JSON

From defaults, produce:

`docs/initial-config/<appKey>.runtime-config.initial.json`

Trade reference: `docs/initial-config/trade-mapping.runtime-config.initial.json`

No secrets, no deployment hosts, no credentials. Include runtime ArcGIS `kind` + `portalItemId`.

### STEP 5 — Create application in Admin

- Name (display)
- Application key (exact match to `APPLICATION_KEY`)
- Active = true

### STEP 6 — Populate initial config

Paste / import the initial JSON into Admin and **Save**  
(`PUT /api/v1/admin/applications/:appKey/config`).

→ States: **REGISTERED** + **POPULATED**

### STEP 7 — Verify public GET

```bash
curl -s http://localhost:3000/api/v1/config/trade-mapping
```

Confirm `app.name` / catalog match the initial document.

→ **REACHABLE** (backend side)

### STEP 8 — Configure consumer env

Set in the app `.env` (then **restart** Vite):

```env
VITE_RUNTIME_CONFIG_URL=https://localhost:5179
```

(Use the app’s own HTTPS origin when relying on the Vite proxy.)

### STEP 9 — Start / deploy consumer

`npm run dev` (or deploy with the same env).

### STEP 10 — Verify REMOTE source

Open DevTools console (development). After load you should see:

```text
[runtime-config] { source: 'remote', error: null, ... }
```

Network tab must show:

`GET /api/v1/config/trade-mapping` → 200

If `source: 'defaults'`, read `error` and fix env/proxy/CORS/HTTP status before continuing.

→ **REACHABLE** (consumer side)

### STEP 11 — Change one harmless **visible** field in Admin

**Important for Trade:** `/` redirects to the first published solution when the catalog is non-empty, so `app.homeTitle` is often **not rendered**.

Prefer a field that is always on screen when signed in, e.g.:

- `app.name` (sidebar brand, footer, login heading)
- or `app.documentTitle` (browser tab)

Example proof value: `Trade Mapping Runtime Proof`

### STEP 12 — Immediately verify public GET

```bash
curl -s http://localhost:3000/api/v1/config/trade-mapping
```

Confirm the changed field is present. If not, Admin is not writing the backend Trade reads.

### STEP 13 — Full browser refresh of the consumer

Fetch-on-load only. No polling. Hard refresh the Trade tab.

### STEP 14 — Verify UI shows the new value

Confirm sidebar/login/tab title (whichever you changed).

→ **CONNECTED**

### STEP 15 — Restore original value

Save original content in Admin; refresh Trade; confirm restore.

---

## Common breaks (Trade diagnosis lessons)

| Symptom | Likely cause |
|---------|----------------|
| Admin edits, UI unchanged | `VITE_RUNTIME_CONFIG_URL` missing → silent **defaults** fallback |
| Env set, still defaults | Vite not restarted after `.env` change |
| Mixed content / failed fetch | HTTPS UI calling `http://localhost:3000` without proxy |
| Proxy 200 but “no change” | Edited `homeTitle` while Home redirects to a solution — pick a visible field |
| Admin OK, GET wrong | Admin `VITE_API_BASE_URL` ≠ Trade’s Runtime Config backend |

---

## Manual CONNECTED proof (Trade)

1. Confirm Admin `VITE_API_BASE_URL=http://localhost:3000`.
2. Confirm Trade `VITE_RUNTIME_CONFIG_URL=https://localhost:5179` and restart `npm run dev`.
3. Open Trade → DevTools → Network: `GET .../api/v1/config/trade-mapping` 200; Console: `source: 'remote'`.
4. In Admin, set `app.name` to `Trade Mapping Runtime Proof`; Save.
5. `curl http://localhost:3000/api/v1/config/trade-mapping` → name is the proof string.
6. Hard-refresh Trade → sidebar/login show the proof string.
7. Restore `app.name` to `Trade Mapping`; refresh again.

Only after step 6 may Trade be called **CONNECTED**.
