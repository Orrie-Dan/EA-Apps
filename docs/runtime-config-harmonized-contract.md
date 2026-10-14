# Runtime Config — Harmonized Contract (HARM-01)

**Status:** DESIGN / CONTRACT ONLY — no applications, backend, Admin UI, database, or consumer client were modified.  
**Inputs:** `docs/runtime-config-multi-app-audit.md` + Education Mapping pilot shape (documented in this task).  
**Scope:** One Runtime Config V1 contract for seven applications.  
**Date:** 2026-09-17

---

# 1. Purpose

Define a single **Runtime Config V1** document contract that supports:

| Application key | Role |
|-----------------|------|
| `education-mapping` | Existing pilot consumer |
| `population-mapping` | Audited |
| `trade-mapping` | Audited |
| `land-administration` | Audited |
| `disaster-emergency-mapping` | Audited |
| `health-mapping` | Audited |
| `infrastructure-mapping` | Audited |

The contract separates:

1. **Common configuration** — shared content sections  
2. **Common module / application catalog** — modules → apps + ArcGIS embed metadata  
3. **Application-specific configuration** — `extensions` bag  
4. **Deployment configuration** — env / host topology (outside Runtime Config)  
5. **Secrets** — never in Runtime Config  

Applications may omit optional sections. Validators must not require Education-only content for other apps.

---

# 2. Field-by-field mapping (Education Mapping ↔ six-app audit)

| Education Mapping (pilot) | Six-app audit equivalent | Decision |
|---------------------------|--------------------------|----------|
| `app.name` | `portal.name` in `src/data/config.js` | **KEEP as common** |
| `app.shortName` | `portal.shortName` | **KEEP as common** |
| `app.description` | `portal.description` (often `''`) | **KEEP as common** (optional empty) |
| `app.eyebrow` | `portal.eyebrow` (empty on Disaster/Health/Infra) | **KEEP as common** (optional) |
| `app.homeTitle` | `portal.homeTitle` | **KEEP as common** |
| `app.homeLead` | `portal.homeLead` | **KEEP as common** |
| `app.tagline` | `portal.tagline` | **KEEP as common** |
| `app.hero` | `portal.hero` (public path or imported asset URL) | **KEEP as common** under `app.hero` — do **not** migrate to `branding` |
| *(none)* | `index.html` `<title>` | **ADDITIVE** optional `app.documentTitle` |
| `organization.name` | Footer kicker `GeoHub Rwanda` (Disaster/Health/Infra); implied elsewhere | **KEEP as common** |
| `organization.legalName` | “Rwanda Space Agency” in copyright / legal | **KEEP as common** |
| `organization.copyrightYear` | Hardcoded `© 2026 …` | **KEEP as common** — consumer formats copyright |
| `contact.heading` | `footer.contact.heading` (Pop/Trade/Land) | **KEEP as common** |
| `contact.email` | `footer.contact.email` | **KEEP as common** |
| `contact.agency` | `footer.contact.agency` | **KEEP as common** |
| `contact.phone` | `footer.contact.phone` | **KEEP as common** |
| `contact.phoneLabel` | Pop/Trade/Land footer UI supports `phoneLabel` | **KEEP as common** |
| `footer.blurb` | `footer.blurb` | **KEEP as common** |
| *(none)* | `footer.quickLinks[]` | **ADDITIVE** optional `footer.quickLinks` |
| `legal.disclaimer\|privacy\|terms\|accessibility` `{title, body[]}` | `LegalPage.jsx` page maps | **KEEP** Education object shape (not `pages[]`) |
| `modules[]` | `modules[]` / catalog | **KEEP name `modules`** |
| `modules[].apps[]` | `modules[].solutions[]` | **KEEP `apps`** for pilot compatibility; Admin label “applications”; code alias `solutions` → `apps` at integration |
| `modules[].id,name,icon,description,image` | same on modules | **KEEP as common** |
| *(none)* | `modules[].features[]` (unused in UI) | **Not common V1** — use `extensions` if an app later surfaces them |
| *(none)* | `modules[].hidden` (Land filter) | **ADDITIVE** optional `modules[].hidden` |
| `apps[].id,name,description,type,image,icon` | solution fields | **KEEP as common** |
| `apps[].footerLabel` | Footer quick-link labels (sometimes derived from name) | **KEEP as common** (optional; fallback = `name`) |
| `apps[].kind` (`experience` \| `dashboard`) | solution `type` + `access.js` path shape | **KEEP `kind`** as operational discriminator |
| `apps[].portalItemId` | Dashboard/Experience UUID in `access.js` | **KEEP** — preferred over storing full GeoHub URLs |
| *(none)* | Multi-portal hosts, Survey123, external URL, local shells | **ADDITIVE** optional fields on `apps[]` (see §7) |
| Full `portalUrl` / `embedUrl` strings in six apps | Constructed today in `access.js` | **Not preferred in V1 common** — construct in consumer from deploy `PORTAL_URL` + `kind` + `portalItemId` (Education pattern); use optional overrides only when required |
| Audit-proposed top-level `branding` | LogoMark / favicon / hero | **ADDITIVE** optional `branding` for logo/favicon only; hero stays `app.hero` |
| App-unique catalogs / orphans / proxy modes | per-app `access.js` / server | **`extensions`** + optional app fields — not forced into common |

---

# 3. Naming harmonization

| Concept | Code / JSON field | Admin Portal label | Notes |
|---------|-------------------|--------------------|-------|
| Top-level product workspace | `app` | General | Matches Education Mapping |
| Catalog group | `modules` | Modules | Matches both worlds |
| Catalog leaf | `apps` | Applications | **Keep `apps`** (Education Mapping). Six-app source says `solutions` — map at integration; do not rename JSON for aesthetics |
| Combined Admin nav | — | **Modules & applications** | UI wording only |
| ArcGIS leaf metadata | `kind` + `portalItemId` | Application type + Portal item ID | Education Mapping pattern |
| Display chip (Dashboard / Experience / Form) | `type` | Display type | Human-facing; may differ in casing from `kind` |
| Org display | `organization.name` | Organization name | e.g. GeoHub Rwanda |
| Legal entity | `organization.legalName` | Legal name | e.g. Rwanda Space Agency |

**Rule:** Do not rename Education Mapping fields merely to match six-app local variable names.

---

# 4. Common V1 contract

Document root is a JSON object stored per `applicationKey`.

## 4.1 Top-level shape

```json
{
  "app": { },
  "organization": { },
  "contact": { },
  "footer": { },
  "legal": { },
  "modules": [ ],
  "branding": { },
  "extensions": { }
}
```

| Section | Required in API payload? | Notes |
|---------|--------------------------|-------|
| `app` | **Recommended**; soft-required for Admin | Consumer merges with bundled defaults |
| `organization` | Optional | |
| `contact` | Optional | |
| `footer` | Optional | |
| `legal` | Optional | Per-page keys optional |
| `modules` | Optional (default `[]`) | |
| `branding` | Optional | |
| `extensions` | Optional | Opaque to common validator beyond “object” |

Validators must **preserve unknown top-level keys** and all of `extensions`.

---

## 4.2 `app`

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `name` | string | recommended | Product display name | Application name | Bundled default |
| `shortName` | string | optional | Compact / nav short label | Short name | `name` |
| `description` | string | optional | Longer product description | Description | `""` |
| `eyebrow` | string | optional | Small home eyebrow | Eyebrow | `""` |
| `homeTitle` | string | optional | Home heading | Home title | `name` |
| `homeLead` | string | optional | Home supporting sentence | Home lead | `""` |
| `tagline` | string | optional | Marketing / login tagline | Tagline | `""` |
| `hero` | string (URL or public path) | optional | Hero / login imagery | Hero image | Bundled asset path |
| `documentTitle` | string | optional | Browser tab title | Browser tab title | `name` |

**Compatibility:** Education Mapping fields unchanged (**NO CHANGE**). `documentTitle` is **ADDITIVE**.

---

## 4.3 `organization`

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `name` | string | optional | Public org / platform name | Organization name | Bundled / empty |
| `legalName` | string | optional | Legal entity for copyright | Legal name | Bundled |
| `copyrightYear` | number or string | optional | Copyright year | Copyright year | Bundled year |

Consumer may render: `© {copyrightYear} {legalName}`.

**Compatibility:** **NO CHANGE** vs Education Mapping.

---

## 4.4 `contact`

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `heading` | string | optional | Contact column heading | Contact heading | `"Contact"` or hide |
| `email` | string | optional | Contact email | Email | Hide if empty |
| `agency` | string | optional | Agency line | Agency | Hide if empty |
| `phone` | string | optional | Phone number | Phone | Hide if empty |
| `phoneLabel` | string | optional | Phone caption | Phone label | Hide / default label |

**Compatibility:** **NO CHANGE**.

---

## 4.5 `footer`

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `blurb` | string | optional | Footer brand paragraph | Footer blurb | Bundled |
| `quickLinks` | array of `{ label: string, to: string }` | optional | Footer nav links | Quick links | Derive from modules/apps or bundled |

**Compatibility:** `blurb` **NO CHANGE**. `quickLinks` **ADDITIVE** (needed by all six audited apps).

---

## 4.6 `legal`

Keep Education Mapping’s keyed object (not a free-form array):

```json
"legal": {
  "disclaimer": { "title": "…", "body": ["…"] },
  "privacy": { "title": "…", "body": ["…"] },
  "terms": { "title": "…", "body": ["…"] },
  "accessibility": { "title": "…", "body": ["…"] }
}
```

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `*.title` | string | optional per page | Legal page title | Page title | Bundled |
| `*.body` | string[] | optional per page | Paragraphs | Page body | Bundled |

Missing page keys → consumer uses bundled defaults for that page only.

**Compatibility:** **NO CHANGE** shape.

---

## 4.7 `branding` (optional section)

### Decision summary

- **Hero stays on `app.hero`** (Education Mapping) — moving it would be a needless migration.  
- **`branding` is ADDITIVE** for marks not already covered by `app.hero`.  
- **Out of scope for V1:** CSS theme tokens, Vite-imported binary pipelines, color systems, build asset hashing.

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `logo` | string (URL/path) | optional | Header / login logo image | Logo | Component default / LogoMark |
| `favicon` | string (URL/path) | optional | Favicon | Favicon | `/favicon.svg` bundled |

Apps that only use inline SVG LogoMark may leave `branding` empty.

---

## 4.8 `modules` / applications (catalog)

### Module object

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `id` | string (kebab / slug) | required if module present | Stable route id | Module ID | — |
| `name` | string | required if module present | Module title | Module name | — |
| `icon` | string | optional | Icon key (e.g. lucide name) | Icon | default icon |
| `description` | string | optional | Module description | Description | `""` |
| `image` | string | optional | Module card image | Image | placeholder |
| `hidden` | boolean | optional | Exclude from published nav | Hidden | `false` |
| `apps` | array | optional | Child applications | Applications | `[]` |

`features[]` is **not** a common V1 field (audit: unused in UI). If needed later → `extensions`.

### Application object (`modules[].apps[]`)

| Field | Type | Req | Purpose | Admin label | Fallback |
|-------|------|-----|---------|-------------|----------|
| `id` | string | required if app present | Stable route / catalog id | Application ID | — |
| `name` | string | required if app present | Display name | Application name | — |
| `footerLabel` | string | optional | Footer link label | Footer label | `name` |
| `description` | string | optional | Card / detail text | Description | `""` |
| `type` | string | optional | Display type label (`Dashboard`, `Experience`, `Form`, …) | Display type | derived from `kind` |
| `image` | string | optional | Card image | Image | module image |
| `icon` | string | optional | Icon key | Icon | default |
| `kind` | string enum | conditional | Embed constructor discriminator | Embed kind | see §7 |
| `portalItemId` | string | conditional | ArcGIS item / form id | Portal item ID | see §7 |
| `portalHostKey` | string | optional | Selects deploy-time portal base (multi-host apps) | Portal host | primary deploy portal |
| `externalUrl` | string | optional | Non-ArcGIS URL (e.g. inspection site) | External URL | — |
| `localShellPath` | string | optional | Same-origin shell path (`/dashboards/…`) | Local shell path | — |
| `published` | boolean | optional | Explicit publish flag | Published | `true` if embed resolvable |

**Compatibility:** Education fields **NO CHANGE**. New fields **ADDITIVE**.

---

# 5. Module / application ArcGIS contract (critical)

## 5.1 Education Mapping baseline (preferred)

For standard GeoHub embeds:

1. Runtime Config stores `kind` + `portalItemId` (not a fully generated GeoHub URL).  
2. Deployment provides `PORTAL_URL` (e.g. `https://gh.space.gov.rw/portal`).  
3. Consumer constructs the iframe URL:

| `kind` | Construction rule (illustrative) |
|--------|----------------------------------|
| `dashboard` | `{PORTAL_URL}/apps/dashboards/{portalItemId}` |
| `experience` | `{PORTAL_URL}/apps/experiencebuilder/experience/?id={portalItemId}` |

This matches the Education Mapping pilot and avoids duplicating host strings in every item.

## 5.2 `kind` values (V1)

| `kind` | Status | Evidence | Runtime managed | Deploy managed |
|--------|--------|----------|-----------------|----------------|
| `dashboard` | **Common** | Education + all six apps | item id | `PORTAL_URL` or host map |
| `experience` | **Common** | Education + Land/Disaster/Health/Infra | item id | same |
| `survey123` | **ADDITIVE** | Health Mapping forms | form id in `portalItemId` | Survey123 / partner portal base + proxy |
| `external` | **ADDITIVE** | Infrastructure `inspection` URL | `externalUrl` | none / allow-list |
| `localShell` | **ADDITIVE** | Pop/Trade/Land/Disaster local `/dashboards` shells | `localShellPath` | static files under `public/` |

**V1 rule:** Education Mapping continues to use only `dashboard` | `experience`. Other kinds are optional and ignored by Education consumer until upgraded.

## 5.3 Multi-portal hosts

Audited reality: Disaster / Health / Infrastructure embed items from multiple agencies.

**V1 approach (simple):**

- Optional `apps[].portalHostKey` (e.g. `gh`, `rmb`, `ewis`, `rbc`, `wasac`, `esrirw`).  
- Mapping `portalHostKey → base portal URL` lives in **deployment config** (env / server), not Runtime Config.  
- Runtime Config never stores partner passwords or tokens.

Do **not** require `portalHostKey` for single-portal apps (Education, Population, Trade, Land).

## 5.4 What is runtime vs deployment vs secret

| Concern | Layer |
|---------|-------|
| Module/app titles, descriptions, images, icons, order, hidden/published | **Runtime** |
| `kind`, `portalItemId`, `externalUrl`, `localShellPath`, `portalHostKey` | **Runtime operational** (careful Admin) |
| `PORTAL_URL`, partner portal base URLs, proxy routes, `PUBLIC_ORIGIN` | **Deployment** |
| Client secrets, session secrets, portal tokens, RBC/WASAC passwords | **Secret — excluded** |

## 5.5 Full URL storage

Six apps today store full `portalUrl` / `embedUrl` strings. Harmonized V1 **prefers** Education’s `kind` + `portalItemId`.  

**Migration for six apps (at integration time, not HARM-01):** split URLs into id + kind (+ optional host key).  
Optional escape hatch (not encouraged): `extensions` may hold legacy URL maps during transition — consumer-specific, not common required fields.

---

# 6. Application-specific configuration (`extensions`)

## 6.1 Pattern (V1)

```json
{
  "extensions": {
    "<applicationKeyOrTopic>": {
      "...": "app-owned fields"
    }
  }
}
```

Example topics justified by audit evidence (optional; only when needed):

| Application | Possible `extensions` content | Why not common |
|-------------|-------------------------------|----------------|
| `disaster-emergency-mapping` | `moduleFeatures` map, orphan app notes | `features[]` unused in UI; orphans are cleanup |
| `health-mapping` | survey proxy hints already covered by `kind=survey123`; keep minimal | partner auth stays deploy |
| `infrastructure-mapping` | mirror-mode flags if not expressible via `localShell` / host key | WASAC mirror is deploy-coupled |
| `population-mapping` | staged apps (e.g. income) not yet in modules | catalog hygiene |
| `land-administration` | usually none if `hidden` + `experience` suffice | — |

## 6.2 Rules

- Common Admin sections stay fixed and predictable.  
- Common consumer **must preserve** `extensions` and unknown fields when merging.  
- Backend **must not** strip `extensions` on read/write.  
- V1 does **not** define a plugin framework, dynamic form schema registry, or per-app Admin codegen.  
- Admin may later show a small curated form per application key; until then, extensions can remain empty for most apps.

---

# 7. Deployment configuration (outside Runtime Config)

Remain environment / deploy controlled:

| Item | Evidence |
|------|----------|
| Runtime Config API base URL | platform |
| `applicationKey` wired in consumer bootstrap | per app |
| `PORTAL_URL` / primary GeoHub portal | all apps `.env` / `access.js` |
| `PUBLIC_ORIGIN` | `.env` |
| Partner portal bases (`WASAC_ORIGIN`, RBC, EsriRW, RMB, EWIS, RURA, REG, …) | Health / Infra / Disaster |
| Host-key → URL maps for proxies | `PROXY_HOSTS` / server |
| Vite ports, HTTPS plugin, `vercel.json` SPA rewrites | build/deploy |
| Same-origin dashboard static shells under `public/dashboards` | deploy artifacts |
| CORS / cookie names / session cookie flags | server |
| Auth mode differences (AuthProvider vs LandingPage) | application code |

---

# 8. Secrets (prohibited)

Runtime Config **must never** store:

- passwords (user, portal, INFRA/WASAC/RBC, …)  
- JWT / session signing secrets (`SESSION_SECRET`)  
- database URLs with credentials  
- ArcGIS / OAuth client secrets (`PORTAL_CLIENT_SECRET`, …)  
- private API keys  
- portal / partner tokens (`PORTAL_TOKEN`, `ESRIRW_TOKEN`, `RBC_TOKEN`, `WASAC_TOKEN`, …)  

Runtime Config Admin is **not** a secret manager.

---

# 9. Backward compatibility classification

| Change | Class | Justification |
|--------|-------|---------------|
| Keep `app.*` Education fields including `hero` | **NO CHANGE** | Pilot already works |
| Keep `organization`, `contact`, `footer.blurb`, `legal` keyed pages | **NO CHANGE** | Pilot |
| Keep `modules[].apps[]` with `kind` + `portalItemId` | **NO CHANGE** | Pilot |
| Add optional `app.documentTitle` | **ADDITIVE** | Six-app `index.html` titles |
| Add optional `footer.quickLinks` | **ADDITIVE** | All six audited apps |
| Add optional `branding.logo` / `branding.favicon` | **ADDITIVE** | Logos/favicons outside `app.hero` |
| Add optional `modules[].hidden` | **ADDITIVE** | Land |
| Add optional app fields: `portalHostKey`, `externalUrl`, `localShellPath`, `published` | **ADDITIVE** | Multi-host / external / shells |
| Extend `kind` with `survey123` \| `external` \| `localShell` | **ADDITIVE** | Health / Infra / shells; Education ignores |
| Add top-level `extensions` | **ADDITIVE** | Escape hatch without schema churn |
| Rename `apps` → `solutions` | **Rejected** | Would be **MIGRATION REQUIRED** for Education with only aesthetic benefit |
| Move `hero` → `branding.hero` | **Rejected** | **MIGRATION REQUIRED** without material gain |

### Does Education Mapping require migration?

**No immediate migration required** for V1 if the backend treats new fields as optional and preserves unknown keys. Education Mapping can keep publishing its current document shape.

---

# 10. Backend validator impact (design only — do not implement)

Assume today’s validator is Education-centric. Required adjustments:

| Topic | Guidance |
|-------|----------|
| Education-required fields today | Soften: prefer validating *shape when present*, not requiring every Education section for every `applicationKey` |
| Cross-app required minimum | Suggest: `applicationKey` exists; document is object; if `modules` present, each module/app has `id` + `name` |
| Optional common sections | `organization`, `contact`, `footer`, `legal`, `branding`, `extensions` all optional |
| New common fields | Accept `documentTitle`, `quickLinks`, `branding`, `hidden`, additive app embed fields |
| `kind` enum | Allow `dashboard` \| `experience` always; optionally allow additive kinds without rejecting older docs |
| `portalItemId` | Required only when `kind` is `dashboard` \| `experience` \| `survey123`; not required for `external` / `localShell` |
| `externalUrl` | Required when `kind === "external"` |
| `localShellPath` | Required when `kind === "localShell"` |
| Extensions | Type = object; no deep schema in V1; **do not strip** |
| Unknown fields | **Preserve** on read/write (forward compatibility) |
| Population vs Education | Population config **must not** fail because it lacks Education-only modules/content |

---

# 11. Admin Portal impact (design only — do not implement)

Non-developer navigation for a selected application:

| Nav section | Maps to contract | Notes |
|-------------|------------------|-------|
| General | `app` | name, shortName, description, eyebrow, homeTitle, homeLead, tagline, documentTitle, hero |
| Branding | `branding` | logo, favicon (hide section if app unused) |
| Organization | `organization` | name, legalName, copyrightYear |
| Contact | `contact` | heading, email, agency, phone, phoneLabel |
| Footer | `footer` | blurb + quick links editor |
| Legal | `legal` | four pages, paragraph lists — no raw JSON |
| Modules & applications | `modules` / `apps` | nested editor; embed fields behind “Advanced” or role gate |

### Application-specific extensions in Admin (future, simple)

- Do **not** expose JSON to normal editors.  
- V1: most apps need **no** extension UI.  
- Later: optional curated fields registered per `applicationKey` (static allow-list in Admin), still written under `extensions`.  
- Operational ArcGIS fields (`portalItemId`, `kind`, host key) use constrained inputs (dropdowns, id field), not free-form URL pasting when avoidable.

---

# 12. Reusable consumer contract (design only — do not implement)

## Responsibilities

1. Load config: `GET /api/v1/config/:applicationKey`  
2. Validate lightly (object root; safe fail)  
3. Deep-merge with **bundled defaults** (app wins over defaults for defined keys; arrays: replace or documented strategy — recommend **replace modules array** when remote provides `modules`)  
4. Preserve unknown fields and `extensions`  
5. Expose `{ status: 'loading'|'ready'|'error', config, error }`  
6. On network/4xx/5xx/invalid → **bundled defaults** (never blank shell)  
7. Build embed URLs from deploy `PORTAL_URL` (+ host map) using `kind` / `portalItemId`  
8. No secrets; no app-specific business rules inside the shared helper  

## V1 delivery recommendation

**Start as a copied standard integration module** (documented files: `loadRuntimeConfig`, `RuntimeConfigProvider`, `defaults`, `types`), then **promote to an internal shared package** once two or more apps are integrated and the API is stable.

| Option | Pros | Cons |
|--------|------|------|
| **A. Copied standard module** | Zero package infra; works across separate folders/repos immediately | Drift risk |
| **B. Internal shared package** | Single fix for all apps | Needs package hosting/versioning early |

**HARM-01 choice:** **A for first integration**, with file layout and merge rules identical so promotion to **B** is mechanical.  
(Aligned with “simplest maintainable V1”; audit’s package idea remains the end state.)

---

# 13. Example configurations

See:

- [`docs/examples/education-mapping.runtime-config.example.json`](examples/education-mapping.runtime-config.example.json)  
- [`docs/examples/population-mapping.runtime-config.example.json`](examples/population-mapping.runtime-config.example.json)  
- [`docs/examples/health-mapping.runtime-config.example.json`](examples/health-mapping.runtime-config.example.json)  

Placeholders used instead of production secrets or unnecessary full URL duplication.

---

# 14. Migration matrix (seven applications)

| Application | Current source | Application key | Common sections used | Modules / catalog | App-specific extension | Backend validator impact | Consumer integration impact |
|-------------|----------------|-----------------|----------------------|-------------------|------------------------|--------------------------|-----------------------------|
| Education Mapping | Pilot Runtime Config consumer | `education-mapping` | app, organization, contact, footer, legal, modules | `modules[].apps[]` with `dashboard`/`experience` + `portalItemId` | None required | Keep accepting current docs; ignore new optional fields | **None** if additive-only |
| Population Mapping | `config.js` + `access.js` | `population-mapping` | app, org, contact, footer (+ quickLinks), legal, branding?, modules | demographics → demographic-data; income may be extension/staged | optional staged `income` | Optional sections only | LOW–MEDIUM; map solutions→apps; split dashboard URLs→ids |
| Trade Mapping | same | `trade-mapping` | same | trade → trade-centers-v1, cross-borders | None | same | LOW–MEDIUM |
| Land Administration | same | `land-administration` | same | land-mapping + immovable-property; experience id | optional `hidden` | allow `hidden`; experience kind | LOW–MEDIUM |
| Disaster & Emergency | richer `config.js` + multi-host `access.js` | `disaster-emergency-mapping` | same | multi-module hazard/response; mix dashboard/experience/localShell | optional features/orphans in extensions | allow additive kinds + `portalHostKey` | MEDIUM |
| Health Mapping | multi-portal + Survey123 | `health-mapping` | same | many modules; `survey123` apps | minimal; proxy stays deploy | allow `survey123` kind | HIGH (ops/proxy) |
| Infrastructure Mapping | multi-agency + mirror + external | `infrastructure-mapping` | same | four modules; `external` inspection; host keys | optional mirror flags | allow `external` + host keys | HIGH |

---

# 15. Decision log

## DECISION HARM-01-01 — Common configuration structure

**Decision:** Common V1 sections are `app`, `organization`, `contact`, `footer`, `legal`, `modules`, plus optional `branding` and `extensions`.  
**Reason:** Matches Education Mapping pilot and covers all six audited apps’ content surfaces.  
**Alternatives considered:** Audit-only model renaming `portal`→different roots; array-based `legal.pages[]`.  
**Compatibility impact:** **NO CHANGE** for Education core sections; branding/extensions **ADDITIVE**.

## DECISION HARM-01-02 — Module / application naming

**Decision:** Keep JSON field `modules[].apps[]`. Admin label: “Modules & applications”. Six-app `solutions` maps to `apps` at integration.  
**Reason:** Avoid Education Mapping breaking rename; Admin can use clearer English than code.  
**Alternatives considered:** Rename to `solutions` (**MIGRATION REQUIRED**); dual-write both keys (complexity).  
**Compatibility impact:** **NO CHANGE** for Education; documentation alias for others.

## DECISION HARM-01-03 — Application-specific extensions

**Decision:** Optional top-level `extensions` object; opaque in common validator; preserved on R/W.  
**Reason:** Prevents schema churn for one-off fields; keeps common Admin stable.  
**Alternatives considered:** Per-app top-level namespaces; plugin framework; forcing all fields into common.  
**Compatibility impact:** **ADDITIVE**; Education may omit entirely.

## DECISION HARM-01-04 — Deployment vs runtime boundary

**Decision:** Runtime stores content + operational item ids / kinds / optional host keys / external or local paths. Deployment stores portal base URLs, proxies, origins, build. Secrets never in Runtime Config. Prefer Education URL construction over storing full GeoHub URLs.  
**Reason:** Matches pilot; scales to multi-portal via host keys without putting tokens in Admin.  
**Alternatives considered:** Store full embed URLs for every app (duplicates hosts; harder to re-point environments).  
**Compatibility impact:** Education **NO CHANGE**; six apps migrate URLs→ids at integration (**integration-time**, not contract break for pilot).

## DECISION HARM-01-05 — Reusable consumer approach

**Decision:** V1 = documented **copied standard module**; promote to **internal shared package** after ≥2 integrations.  
**Reason:** Separate app folders/repos; simplest path to first production consumer without package infra.  
**Alternatives considered:** Package-first; fully bespoke per app (drift).  
**Compatibility impact:** None on Education until it optionally switches to the shared module/package.

## DECISION HARM-01-06 — Branding section

**Decision:** Keep `app.hero`; add optional `branding.logo` and `branding.favicon` only. No theme tokens in Runtime Config V1.  
**Reason:** Hero already lives under `app` in Education; logos/favicons are the only extra branding evidence needing a home.  
**Alternatives considered:** Move hero under `branding` (migration); skip branding section entirely (favicon/logo stay hardcoded longer).  
**Compatibility impact:** **ADDITIVE**.

## DECISION HARM-01-07 — Embed `kind` extension

**Decision:** Core kinds remain `dashboard` | `experience`. Additive kinds: `survey123`, `external`, `localShell`.  
**Reason:** Required by Health / Infrastructure / local shells evidence; Education unaffected.  
**Alternatives considered:** Encode everything as `externalUrl` only (loses Admin clarity); delay multi-kind to V2 (blocks Health/Infra honesty).  
**Compatibility impact:** **ADDITIVE**.

---

# 16. Final recommendation

1. **Can all seven applications use one Runtime Config platform?**  
   **Yes.**

2. **Can they use one common base contract?**  
   **Yes** — `app`, `organization`, `contact`, `footer`, `legal`, `modules[].apps[]`, optional `branding` / `extensions`.

3. **Which parts must remain application-specific?**  
   Catalog instances (which modules/apps exist); multi-portal host maps and proxies (deployment); Survey123/WASAC/RBC credentials (secrets); auth shell differences; optional `extensions` and additive embed kinds/fields.

4. **Does Education Mapping require migration?**  
   **No** for V1 if changes stay additive and the validator softens Education-only requirements for other keys.

5. **What backend validator changes are required?**  
   Soften cross-app required fields; allow optional sections; accept additive embed fields/kinds; preserve unknown fields and `extensions`; do not reject Population (etc.) for missing Education-only content.

6. **Should the consumer be a copied standard module or shared package?**  
   **Copied standard module first**, then internal package after two integrations.

7. **Which application should be integrated first after harmonization?**  
   **`trade-mapping` or `population-mapping`** (smallest catalogs, single portal, AuthProvider shell). Prefer **`population-mapping`** if aligning next work to demographic content; prefer **`trade-mapping`** if avoiding the orphan `income` catalog issue on day one.

---

# 17. Stop

No application source, Runtime Config backend, Admin UI, database, or consumer client was implemented or modified in HARM-01.

HARM-01 COMPLETE — RUNTIME CONFIG CONTRACT HARMONIZED
