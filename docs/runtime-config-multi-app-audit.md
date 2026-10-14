# Runtime Config — Multi-Application Compatibility Audit

**Status:** AUDIT ONLY — no application source, Runtime Config backend, or Admin portal was modified.  
**Workspace inspected:** `c:\Users\user\Downloads\app`  
**Source delivery:** four zip archives (applications were extracted read-only to `_audit_extract/` for inspection).  
**Pilot reference:** Education Mapping is the existing Runtime Config pilot but is **not present** in this workspace. Common model proposals below are derived from the six apps actually found here — not from Education Mapping’s schema.  
**Audit date:** 2026-09-17

---

# Executive Summary

Six consumer frontends were discovered. All are **React 19 + Vite 6 + react-router-dom** workspace shells that already centralize most product content in `src/data/config.js` and ArcGIS operational identifiers in `src/lib/access.js`. **None** currently call a Runtime Config API (`GET /api/v1/config/:applicationKey`).

They fall into two integration families:

| Family | Apps | Auth shell | Catalog richness | Migration complexity |
|--------|------|------------|------------------|----------------------|
| **AuthProvider shell** | Population, Trade, Land | Real GeoHub login via `AuthProvider` | Small (1–2 modules) | **LOW–MEDIUM** |
| **LandingPage shell** | Disaster, Health, Infrastructure | Fake landing username/password (no `AuthProvider`) | Large (many modules/solutions; optional `features[]`) | **MEDIUM–HIGH** (Health/Infrastructure **HIGH**) |

A **shared common runtime configuration model** is strongly supported by source evidence: `app` / portal branding, organization/footer chrome, contact placeholders, legal pages, links, and a modules→solutions catalog with ArcGIS embed metadata.

Recommended path: finalize a **small reusable Runtime Config consumer package** (fetch + merge + provider), publish **common + app-specific schema sections** in the Admin portal for non-developers, then onboard apps starting with the simpler AuthProvider family before the multi-portal Health/Infrastructure apps.

---

# Applications Discovered

Workspace root contained only zip archives. Actual applications after extraction:

| # | Folder (audit extract) | Zip source | Discoverable name | Frontend | Language | Build | Package manager | Entry | Runtime Config today? |
|---|------------------------|------------|-------------------|----------|----------|-------|-----------------|-------|------------------------|
| 1 | `_audit_extract/population-mapping` | `population-mapping.zip` | Population Mapping (`demographic-information-mapping-app`) | React 19 | JSX/JS | Vite 6 | npm (`package-lock.json`) | `src/main.jsx` → `App.jsx` | **No** |
| 2 | `_audit_extract/trade-mapping-app` | `trade-mapping-app.zip` | Trade Mapping (`trade-mapping-app`) | React 19 | JSX/JS | Vite 6 | npm | `src/main.jsx` → `App.jsx` | **No** |
| 3 | `_audit_extract/land-administration-app` | `land-administration-app.zip` | Land Administration Mapping (`land-administration-app`) | React 19 | JSX/JS | Vite 6 | npm | `src/main.jsx` → `App.jsx` | **No** |
| 4 | `_audit_extract/geohub/Geohub dan/disaster-emergency-portal d` | `Geohub dan.zip` | Disaster and Emergency Mapping (`disaster-emergency-portal`) | React 19 | JSX/JS | Vite 6 | npm | `src/main.jsx` → `App.jsx` | **No** |
| 5 | `_audit_extract/geohub/Geohub dan/Health Mapping d/Health Mapping` | `Geohub dan.zip` | Health Mapping (package name still `disaster-emergency-portal`) | React 19 | JSX/JS | Vite 6 | npm | `src/main.jsx` → `App.jsx` | **No** |
| 6 | `_audit_extract/geohub/Geohub dan/Infrastructure Mapping d` | `Geohub dan.zip` | Infrastructure Mapping (package name still `disaster-emergency-portal`) | React 19 | JSX/JS | Vite 6 | npm | `src/main.jsx` → `App.jsx` | **No** |

**Not treated as applications:** `node_modules`, `dist`, `public/dashboards` shells, `server/`, `api/`, vendor/generated output.

**Not found in workspace:** Education Mapping (pilot), GeoHub hub shell as a standalone product, Inspection Hub as a standalone product (only an external inspection URL inside Infrastructure Mapping).

### Per-app stack notes

#### 1. Population Mapping
- **Config files:** `src/data/config.js`, `src/lib/access.js`
- **Env:** `.env`, `.env.example` (example is comment-only)
- **Env keys (names only):** `PORTAL_URL`, `PUBLIC_ORIGIN`, `SESSION_SECRET`, `PORTAL_CLIENT_ID`, `PORTAL_CLIENT_SECRET`, `PORTAL_TOKEN`
- **Dev port:** 5178

#### 2. Trade Mapping
- Same pattern as Population
- **Dev port:** 5179

#### 3. Land Administration Mapping
- Same pattern; catalog supports Experience Builder (`search` id)
- **Dev port:** 5177

#### 4. Disaster and Emergency Mapping
- Richer catalog; Vite-imported assets; `LandingPage` instead of `/login`
- **Dev port:** 5173; Vite wires `server/vite-plugin.js` access server

#### 5. Health Mapping
- Multi-portal embeds (GeoHub, RBC, Esri Rwanda, Survey123)
- Extra env concepts: `ESRIRW_TOKEN*`, documented `RBC_*` credentials
- **Dev port:** 5175

#### 6. Infrastructure Mapping
- Multi-agency public embeds (WASAC, RURA, REG, GeoHub) + WASAC portal mirror
- Extra env concepts: `WASAC_*`, `INFRA_USERNAME` / `INFRA_PASSWORD`
- **Dev port:** 5174

---

# Cross-Application Configuration Matrix

| Concept | Pop | Trade | Land | Disaster | Health | Infra | Class |
|---------|-----|-------|------|----------|--------|-------|-------|
| App display name / short name | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | A |
| Eyebrow / home title / home lead | ✓ | ✓ | ✓ | ✓ (lead) | ✓ | ✓ | A |
| Tagline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | A |
| Hero image | ✓ public path | ✓ | ✓ | ✓ imported | ✓ imported | ✓ imported | A |
| Document `<title>` (`index.html`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | A |
| Module catalog (id, name, description, icon, image) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | A (+ B for embeds) |
| Solution catalog (id, name, description, type, image, icon) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | A (+ B) |
| Module `features[]` bullet lists | — | — | — | ✓ unused in UI | ✓ unused | ✓ unused | A (optional) |
| Footer blurb | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | A |
| Footer quick links | ✓ | ✓ | ✓ | ✓ derived | ✓ derived | ✓ derived | A |
| Contact email / phone / agency | placeholders | placeholders | placeholders | placeholders (+ phone field) | placeholders (+ phone) | placeholders (+ phone) | A |
| Copyright “© 2026 Rwanda Space Agency” | hardcoded footer | same | same | same | same | same | A |
| Org kicker “GeoHub Rwanda” | — | — | — | hardcoded footer | same | same | A |
| Legal pages (disclaimer/privacy/terms/accessibility) | hardcoded | same | same | hardcoded (variant) | variant | variant | A |
| Logo / brand mark | `LogoMark.jsx` | unique SVG | unique SVG | `app-icon.png` | `app-icon.png` | `app-icon.png` | A |
| ArcGIS dashboard / experience / Survey123 IDs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | B |
| Portal host URL(s) | GeoHub | GeoHub | GeoHub | GeoHub + RMB + EWIS | GeoHub + RBC + EsriRW + S123 | GeoHub + WASAC + RURA + REG + inspection | B / C |
| Same-origin `/dashboards/*` shells | ✓ | ✓ | ✓ | ✓ (some) | leftovers | leftovers | B / C |
| Feature / publish filters (`embedUrl`, `hidden`, special cases) | ✓ | ✓ | ✓ + `hidden` | ✓ special cases | ✓ special cases | ✓ special cases | B |
| API / portal base URLs in env | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | C |
| Vite ports / SSL / Vercel SPA | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | C |
| OAuth / session / portal tokens | ✓ | ✓ | ✓ | ✓ | ✓ + partner tokens | ✓ + partner credentials | D |

Legend: **A** Runtime Content · **B** Runtime Operational · **C** Deployment · **D** Secret

---

# Common Runtime Configuration

Proposed common model based on fields that appear in **multiple** of the six apps (not copied from Education Mapping).

```yaml
common:
  app:
    name                 # all 6
    shortName            # all 6
    description          # present (often empty) all 6
    eyebrow              # Pop/Trade/Land (empty on Disaster/Health/Infra)
    homeTitle            # all 6
    homeLead             # all 6
    tagline              # all 6
    documentTitle        # all 6 via index.html — should move into runtime

  branding:
    heroImage            # all 6 (URL or asset path)
    logoImage            # Disaster/Health/Infra use image; Pop/Trade/Land use inline SVG — model as optional URL + optional markVariant
    favicon              # all 6 index.html

  organization:
    displayName          # “GeoHub Rwanda” in Disaster/Health/Infra footers; implied RSA across all
    copyrightText        # “© 2026 Rwanda Space Agency” all 6

  contact:
    heading              # Pop/Trade/Land (Disaster/Health/Infra omit heading, use email/phone/agency)
    email                # all 6 (currently empty)
    phone                # Disaster/Health/Infra field present; Pop/Trade/Land support phone in footer UI
    agency               # all 6 (currently empty)

  footer:
    blurb                # all 6
    quickLinks[]:        # all 6 (label + to)
      label
      to

  legal:
    pages[]:             # all 6 (disclaimer, privacy, terms, accessibility)
      key
      title
      body[]             # paragraph strings

  links:
    # reserved for external non-route links if added later; today mostly internal quickLinks
```

### Common operational catalog shape (shared concept, app-specific instances)

Present in all six apps as modules → solutions:

```yaml
commonOperational:
  modules[]:
    id
    name
    description
    icon                 # lucide icon key string
    image                # URL/path
    features[]           # optional; Disaster/Health/Infra only today
    hidden               # optional; Land filter supports it
    solutions[]:
      id
      name
      description
      type               # Dashboard | Experience | Form | …
      image
      icon
      # operational join (from access.js today):
      embedUrl
      portalUrl
      source:            # optional structured ArcGIS source
        hostKey
        path
        search
        hash
        public
```

**Applications with equivalents:** all six for `app`, `branding.hero`, `footer`, `contact`, `legal`, `modules/solutions`.  
**Organization display name:** explicit in Disaster/Health/Infrastructure; copyright-only in Population/Trade/Land.

---

# Application-Specific Configuration

Only extensions supported by source evidence:

### `population-mapping`
- Module set: `demographics` → `demographic-data` (published)
- Orphan operational entry: `income` exists in `access.js` + local dashboard shell + footer link, but **not** in catalog solutions
- Session/cookie namespace currently shared with Trade (`demotrade_*`) — deployment hygiene, not Admin content

### `trade-mapping`
- Module set: `trade` → `trade-centers-v1`, `cross-borders`
- Market/corridor-specific copy and public image paths

### `land-administration`
- Multi-module: `land-mapping`, `immovable-property`
- Experience Builder solution (`parcels-surveying` via `search=id=…`)
- `hidden` module filter support
- External Unsplash module image URL in catalog

### `disaster-emergency-mapping`
- Modules: `disaster-mapping`, `emergency-response`
- Local HTML embeds for some hazards (`/dashboards/lightning`, etc.)
- Multi-host sources: GeoHub, RMB, EWIS; Netlify citizen-reporting host
- Special publish rule: keep `volunteer-coordination` even without embed
- Orphan `APP_SOURCES` keys not in published catalog (`volcanic`, `fire`, `citizen-reporting`, `firefighting`, `response-operations`, …)
- Label mismatch example: solution id `lightning` titled “Fire Incidents”

### `health-mapping`
- Six thematic modules (facilities, accessibility, surveillance, emergency, vaccination, food/drugs)
- Survey123 form embeds (`type: Form`)
- Partner portals: RBC, Esri Rwanda; proxy auth modes
- Catalog orphans / access-only keys (e.g. `provincial-to-referral-hospital`)
- Partner credential env surface (`RBC_*`, `ESRIRW_*`) — **not** Runtime Config

### `infrastructure-mapping`
- Four modules: country infrastructure, service accessibility, settlements, government assets
- Multi-agency public dashboard URLs (WASAC, RURA, REG)
- Local WASAC Experience Builder mirror path (`/portal/apps/experiencebuilder/...`)
- External non-ArcGIS solution: `inspection` → `https://inspection.space.gov.rw/`
- WASAC/INFRA credentials — **not** Runtime Config

---

# Deployment Configuration

Must remain environment / deploy controlled (not Admin Runtime Config for normal editors):

| Item | Evidence |
|------|----------|
| `PORTAL_URL`, `PUBLIC_ORIGIN` | `.env` all apps |
| Partner origins (`WASAC_ORIGIN`, `RBC_ORIGIN`, …) | Health / Infra env examples |
| Vite HTTPS + fixed ports (5173–5179) | `vite.config.js` |
| Vercel SPA rewrites | `vercel.json` where present |
| Server proxy / mirror wiring | `server/vite-plugin.js`, `wasac-proxy.js`, `rbc-proxy.js`, etc. |
| Same-origin dashboard shell static files | `public/dashboards/**` |
| Favicon cache-bust query (`?v=3`) | `index.html` |

Portal **host strings** used by embeds sit on the B/C boundary: Admin may select known portal presets, but raw environment topology should stay deploy-owned.

---

# Secrets / Exclusions

**Must NEVER enter Runtime Config** (frontend JSON or Admin content store):

| Secret class | Where found |
|--------------|-------------|
| `SESSION_SECRET` | all apps `.env` |
| `PORTAL_CLIENT_SECRET` | all apps `.env` |
| `PORTAL_TOKEN` | all apps `.env` (present; unused in several frontends) |
| Hardcoded session secret fallbacks in server (`*-dev-session-secret`) | server/api auth files |
| `ESRIRW_TOKEN` / expiry | Health `.env` |
| `RBC_USERNAME`, `RBC_PASSWORD`, `RBC_TOKEN`, `RBC_CLIENT_SECRET` | Health `.env.example` / server |
| `INFRA_USERNAME`, `INFRA_PASSWORD`, `WASAC_*` credentials | Infrastructure `.env` / example |
| User passwords collected on login forms | auth / landing flows |

Also exclude: database credentials, JWT signing keys, private API keys of any kind.

---

# Existing Configuration Patterns

| Application | Primary pattern | Secondary | Centralization | Complexity |
|-------------|-----------------|-----------|----------------|------------|
| Population | JS objects in `config.js` | `access.js` ArcGIS map; hardcoded footer copyright + LegalPage | **Partially centralized** | **LOW–MEDIUM** |
| Trade | same | same | **Partially centralized** | **LOW–MEDIUM** |
| Land | same + Experience `search` | same | **Partially centralized** | **LOW–MEDIUM** |
| Disaster | richer `config.js` + asset imports | multi-host `access.js`; hardcoded GeoHub kicker | **Partially centralized** | **MEDIUM** |
| Health | same family | multi-portal + Survey123 + proxy auth | **Partially centralized** (ops scattered to server) | **HIGH** |
| Infrastructure | same family | multi-agency URLs + WASAC mirror | **Partially centralized** (ops scattered to server) | **HIGH** |

**Scattered leftovers in all apps:** `index.html` title, `SiteFooter` copyright (and GeoHub kicker on LandingPage family), `LegalPage` body copy, `LogoMark` / icon assets, session storage key names.

**No app** loads configuration from API responses today. Auth and catalog are static modules.

---

# Proposed Application Keys

| Application | Proposed key |
|-------------|--------------|
| Population Mapping | `population-mapping` |
| Trade Mapping | `trade-mapping` |
| Land Administration Mapping | `land-administration` |
| Disaster and Emergency Mapping | `disaster-emergency-mapping` |
| Health Mapping | `health-mapping` |
| Infrastructure Mapping | `infrastructure-mapping` |
| Education Mapping (pilot, not in workspace) | `education-mapping` *(reserved)* |

Keys are proposals only — no app was modified to use them.

---

# Runtime Config Integration Points

For every app, the eventual attach surface is nearly identical.

### Shared proposed files (do not create yet)

Under each app’s `src/`:

| Path | Role |
|------|------|
| `config/defaults.js` | Bundled fallback (migrate today’s `data/config.js` + selected `access.js` fields) |
| `config/types.js` | JSDoc or TS typedefs for common + app extension |
| `config/loadRuntimeConfig.js` | `GET /api/v1/config/:applicationKey` + deep-merge with defaults |
| `config/RuntimeConfigProvider.jsx` | Context + hook (`useRuntimeConfig`) |

### Bootstrap / providers

| App family | Bootstrap | Root wrap | Existing providers |
|------------|-----------|-----------|--------------------|
| Pop / Trade / Land | `src/main.jsx` (await load before render **or** provider suspenselike gate) | Wrap inside `App.jsx` **outside or around** `AuthProvider` | `AuthProvider`, `BrowserRouter`, `WorkspaceNavProvider` (in Layout) |
| Disaster / Health / Infra | `src/main.jsx` | Wrap in `App.jsx` around `BrowserRouter` | `BrowserRouter`, `WorkspaceNavProvider`; **no** AuthProvider |

### Primary consumers to rewire later

- `src/data/config.js` (or replace exports with hooks/selectors)
- `src/lib/access.js` (embed/source maps from operational section)
- `LoginPage.jsx` **or** `LandingPage.jsx`
- `Layout.jsx`, `WorkspaceSidebar.jsx`, `HomePage.jsx` / `ModulePage.jsx`
- `SiteFooter.jsx`, `LegalPage.jsx`
- `AppViewer.jsx` / `ArcGisDashboardFrame.jsx`
- `LogoMark.jsx` (optional branding override)

### Server note

Health/Infrastructure proxy credentials and token injection stay **server/env**. Runtime Config should supply **public operational identifiers** (item IDs, which host preset, embed mode), not secrets.

---

# Reusable Consumer Strategy

### Which apps share the same consumer pattern?
**All six.** Same React tree shape, same `portal` + `modules` + `footer` exports, same iframe viewer. One client pattern fits.

### Which use React?
**All six** (React 19).

### Which use Vite?
**All six** (Vite 6).

### Which need a different integration approach?
- **AuthProvider family:** ensure config is available on `/login` before brand render; do not block GeoHub token flow on config API failure (use defaults).
- **LandingPage family:** same, but no real auth provider; optional later auth unification is out of scope for Runtime Config.
- **Health / Infrastructure:** operational schema must support `embedMode` (`direct` | `localShell` | `proxy` | `survey123` | `externalUrl`) and multi-portal host presets; server proxies remain app-specific.

### Reusable internal package?
**Yes — small package recommended**, e.g. `@geohub/runtime-config-client` (name TBD).

**Package should own:**
- Fetch `GET /api/v1/config/:applicationKey` with timeout
- Deep-merge with bundled defaults
- Failure → defaults (never blank the app)
- React `RuntimeConfigProvider` + `useRuntimeConfig`
- Optional tiny validators for common fields

**Remain application-specific:**
- Default JSON/content values
- Module/solution catalogs
- ArcGIS ID maps and embed modes
- LogoMark / CSS theme
- Auth implementation
- Server proxies and secrets
- Admin-only advanced fields per app extension

Avoid a large framework, codegen, or forcing one mega-schema that includes every Survey123/WASAC detail in the common layer.

---

# Admin Portal Implications

Audience: **non-developers**. Editors should not see raw JSON, API paths, or DB schemas for normal work.

### COMMON SECTIONS
1. **General** — name, short name, eyebrow, home title, home lead, tagline, document title  
2. **Branding** — hero image, logo/favicon uploads or URL fields  
3. **Organization** — display name (e.g. GeoHub Rwanda), copyright text  
4. **Contact** — heading, email, phone, agency  
5. **Footer** — blurb; managed quick links (label + internal path)  
6. **Legal** — four pages with rich text / paragraph lists  
7. **Modules & Applications** — module list → solutions list (names, descriptions, icons, images, type, publish/hidden)  
8. **Map applications (operational)** — careful Admin section: dashboard/experience/form IDs, host preset, embed URL/mode (guardrails, validation, “test embed” later)

### APPLICATION-SPECIFIC SECTIONS
| App key | Extra Admin sections |
|---------|----------------------|
| `population-mapping` | Income module alignment (catalog vs orphan IDs) |
| `trade-mapping` | Trade corridor solution set only (no extra schema beyond catalog) |
| `land-administration` | Experience Builder fields; multi-module land vs property |
| `disaster-emergency-mapping` | Hazard module features list; local-shell vs live embed toggle; orphan app cleanup tools |
| `health-mapping` | Form (Survey123) applications; partner portal preset (RBC / EsriRW); accessibility analysis chain |
| `infrastructure-mapping` | Agency host presets (WASAC/RURA/REG); external URL solutions (inspection); portal-mirror experiences |

**Never in Admin UI:** client secrets, passwords, session secrets, portal tokens, raw `.env` editors.

---

# Per-Application Migration Assessment

### Population Mapping
| Field | Value |
|-------|--------|
| Application key | `population-mapping` |
| Complexity | **LOW–MEDIUM** |
| Main runtime-config candidates | `portal.*`, footer, legal, copyright, hero/images, module/solution labels, dashboard IDs for `demographic-data` (+ decide fate of `income`) |
| App-specific | Orphan `income` operational entry; shared `demotrade_*` session keys |
| Likely files affected | `main.jsx`, `App.jsx`, `data/config.js`, `lib/access.js`, `SiteFooter.jsx`, `LegalPage.jsx`, `LoginPage.jsx`, `Layout.jsx`, `WorkspaceSidebar.jsx`, `index.html` |
| Risks | Footer link to unpublished income app; iframe uses `portalUrl` despite comments preferring same-origin shells |

### Trade Mapping
| Field | Value |
|-------|--------|
| Application key | `trade-mapping` |
| Complexity | **LOW–MEDIUM** |
| Main candidates | Branding, footer, two trade solutions + ArcGIS dashboard IDs |
| App-specific | Trade catalog only |
| Likely files | Same pattern as Population |
| Risks | Session key collision with Population if co-hosted on same origin |

### Land Administration
| Field | Value |
|-------|--------|
| Application key | `land-administration` |
| Complexity | **LOW–MEDIUM** |
| Main candidates | Dual-module catalog; Experience Builder id; branding/footer/legal |
| App-specific | `search` experience id; `hidden` flag; Unsplash image dependency |
| Likely files | Same + Experience source shape in access map |
| Risks | Breaking Experience Builder query shape if schema flattens IDs incorrectly |

### Disaster and Emergency Mapping
| Field | Value |
|-------|--------|
| Application key | `disaster-emergency-mapping` |
| Complexity | **MEDIUM** |
| Main candidates | Large hazard/response catalog; multi-host embeds; footer/legal/branding; features lists |
| App-specific | Local HTML embeds; EWIS/RMB hosts; special publish exceptions; orphan keys |
| Likely files | `config.js`, `access.js`, `LandingPage.jsx`, `SiteFooter.jsx`, `LegalPage.jsx`, sidebar/viewer |
| Risks | Catalog/access drift; host field mismatches (EWIS URLs labeled `gh`); lightning/fire naming confusion |

### Health Mapping
| Field | Value |
|-------|--------|
| Application key | `health-mapping` |
| Complexity | **HIGH** |
| Main candidates | Six-module catalog; Survey123 forms; accessibility dashboards; branding/legal |
| App-specific | RBC/EsriRW/S123 embed modes; wrong npm package name |
| Likely files | `config.js`, `access.js`, landing/sidebar/viewer, plus **no** secret migration to client |
| Risks | Proxy auth breakage if operational config points to private apps without server tokens; leftover disaster assets confuse content editors |

### Infrastructure Mapping
| Field | Value |
|-------|--------|
| Application key | `infrastructure-mapping` |
| Complexity | **HIGH** |
| Main candidates | Four-module catalog; multi-agency URLs; branding/legal |
| App-specific | WASAC mirror experience; inspection external URL; agency presets |
| Likely files | `config.js`, `access.js`, landing/sidebar/viewer |
| Risks | Mirror/path coupling; credential leakage if Admin mistakenly asked for WASAC passwords; `.env.example` historically sensitive |

---

# Recommended Integration Sequence

### Work to complete ONCE (before per-app integration)

1. **Confirm Education Mapping pilot contract** (API response shape, merge rules, applicationKey registry) and diff it against this common model — harmonize without forcing Education-only fields onto all apps.  
2. **Freeze common schema** (`app`, `branding`, `organization`, `contact`, `footer`, `legal`, `modules/solutions` operational join).  
3. **Build small reusable client** (fetch, merge, provider, defaults fallback).  
4. **Admin portal common sections** with image upload and module/solution editor UX (no JSON).  
5. **Operational field guardrails** (UUID/item id validation, host presets allow-list).  
6. **Application key registry** in Runtime Config backend for the seven keys (including reserved `education-mapping`).  
7. **Decide embed strategy policy** (portalUrl iframe vs same-origin shell vs proxy) so Admin fields match real runtime behavior.

### Per-app onboarding order (practical)

1. **`trade-mapping`** or **`population-mapping`** — smallest catalogs, AuthProvider shell, single portal (prove end-to-end).  
2. **`land-administration`** — adds Experience Builder field shape.  
3. **`disaster-emergency-mapping`** — richer catalog + multi-host without Survey123/WASAC credential complexity.  
4. **`infrastructure-mapping`** — multi-agency public URLs + mirror/external URL modes.  
5. **`health-mapping`** — hardest operational/auth-proxy surface last.  
6. Align **`education-mapping`** pilot with the harmonized common model (retrofit if needed).

---

# Risks / Open Questions

1. **Education Mapping not in workspace** — common model cannot be validated against the live pilot schema here.  
2. **Embed inconsistency** — comments say do not iframe Portal directly; React currently uses `portalUrl` / mixed local shells / proxies depending on app. Runtime Config must encode one clear policy per solution.  
3. **Catalog vs access drift** — orphans and special-case publish filters will confuse Admin editors unless cleaned or explicitly modeled.  
4. **Package name collisions** — Health and Infrastructure still named `disaster-emergency-portal`.  
5. **Session key collision** — Population and Trade both use `demotrade_*` keys.  
6. **`features[]` dead data** — present in three apps but unused in UI; include in Admin only if product will show them.  
7. **Partner secrets sprawl** — Health/Infra must keep credentials out of Runtime Config while still allowing ID edits.  
8. **Asset strategy** — Vite-imported binaries vs `/public` URLs; Admin uploads need a stable URL convention.  
9. **Legal copy variants** — AuthProvider vs LandingPage families differ; decide one editable structure.  
10. **Inspection URL** — Infrastructure solution is an external site, not an ArcGIS item; schema must allow `externalUrl` type.

---

# Recommended Next Step

**Harmonize schemas before coding integrations:** produce a short `common + extensions` JSON Schema (or OpenAPI fragment) that maps the fields in this audit to the Education Mapping pilot response, then implement the reusable client and Admin common sections. Only after that, integrate the first low-complexity app (`trade-mapping` or `population-mapping`) with bundled defaults fallback.

---

## Appendix A — Notable ArcGIS / operational identifiers (evidence samples)

IDs are operational config candidates (class B), not secrets.

| App | Solution key | Kind | Identifier (from `access.js`) |
|-----|--------------|------|-------------------------------|
| Population | `demographic-data` | Dashboard | `054b8ed856e34779be12f71f8d69356b` |
| Population | `income` | Dashboard | `ec170943e1b1473a81db316fb0c67342` |
| Trade | `trade-centers-v1` | Dashboard | `703cac978e774176bd0b00011d8fc719` |
| Trade | `cross-borders` | Dashboard | `96126effe6c84a218404807db30d42a3` |
| Land | `property-location` | Dashboard | `bc2cbc30989c44dda9a8d27660c3a36f` |
| Land | `parcels-surveying` | Experience | `164589648e2c4e198c40ff1c462bf6e5` |
| Land | `land-use-change` | Dashboard | `1dbaae64924b4f7696272d9d503a94f1` |
| Disaster | `floods` | Dashboard | `902b4a62d0f4420ab66be44e5ad8d40c` |
| Disaster | `emergency-reporting-forms` | Experience | `eb3b4f1694e44638b4547cc1e8a50847` |
| Health | `primary-healthcare-access` | Dashboard | `27973ee1a8e247d7b44a98479eec71f3` |
| Health | `samu-reporting-form` | Survey123 | `9ea5acc523984c45b2aae19a33c43796` |
| Infra | `kigali-water-network-dashboard` | Dashboard (WASAC) | `753103c5542e4bcfb6522b24d645521c` |
| Infra | `inspection` | External URL | `https://inspection.space.gov.rw/` |

Full maps live in each app’s `src/lib/access.js`.

## Appendix B — Hardcoded organization chrome (class A)

| Value | Files |
|-------|-------|
| `© 2026 Rwanda Space Agency` | All six `SiteFooter.jsx` |
| `GeoHub Rwanda` | Disaster / Health / Infra `SiteFooter.jsx` |
| Government of Rwanda ownership sentence | Pop / Trade / Land `LegalPage.jsx` terms |
| Rwanda Space Agency liability sentence | Disaster / Health / Infra `LegalPage.jsx` |

## Appendix C — Extraction note

Zip archives were expanded to `_audit_extract/` solely for this audit. No application source inside those trees was edited as part of Runtime Config integration.

---

**MULTI-APP RUNTIME CONFIG AUDIT COMPLETE — READY FOR HARMONIZATION**
