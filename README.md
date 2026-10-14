# EA GeoHub Mapping Apps

Thirteen sector mapping portals (health, agriculture, environment, …) for the
Rwanda Enterprise Architecture GeoHub, plus the shared **Runtime Config**
backend and its admin console.

Each portal is a small React single-page app. It shows a sidebar of modules and
frames ArcGIS Dashboards, Experience Builder apps and Survey123 forms that live
on GeoHub (`gh.space.gov.rw`) and partner portals (RBC, RDB, WASAC, RURA, REG,
EWIS, MoE, …). The app does not hold content itself. Names, menus, item IDs,
images and typography all come from Runtime Config, so they can be changed
without rebuilding or redeploying anything.

```
 Browser ──► https://gh.space.gov.rw/<app-key>/          static SPA (one per sector)
    │
    ├──► /api/v1/config/<app-key>                        Runtime Config: menus, items, branding
    ├──► /api/v1/app-auth/login                          user signs in with own GeoHub account
    └──► /api/v1/portal-proxy/<app-key>/<host>/…         dashboards, framed through the service,
                                                          which attaches a service-account token
 Runtime Config service (NestJS + PostgreSQL)
    ├── encrypted portal service-account credentials ──► GeoHub + partner portals
    ├── admin API + audit log  ◄── Runtime Config Admin (React)
    └── status monitor (checks every 5 min, email alerts)
```

## Documentation

| Document | Read it when you want to… |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | understand how the system was conceived and built, and why |
| [docs/operations.md](docs/operations.md) | run it locally, build, deploy, change content, troubleshoot |
| [docs/monitoring.md](docs/monitoring.md) | use the Status page, set up alerts, react to red checks |
| [docs/base-path.md](docs/base-path.md) | serve apps under `/<app-key>/` behind a proxy |
| [docs/typography.md](docs/typography.md) | change fonts and sizes for all apps at once |
| [docs/runtime-config-harmonized-contract.md](docs/runtime-config-harmonized-contract.md) | the config document format (HARM-01) |
| [docs/runtime-config-consumer-pattern.md](docs/runtime-config-consumer-pattern.md) | how an app loads and merges its config |
| [docs/runtime-config-application-onboarding.md](docs/runtime-config-application-onboarding.md) | add a new app to Runtime Config |
| [docs/runtime-config-multi-app-audit.md](docs/runtime-config-multi-app-audit.md) | the original per-app audit the contract came from |

The service and the admin console each have their own README too:
`D:\Esri\runtime-config-service\README.md` and `D:\Esri\runtime-config-admin\README.md`.

## The applications

| Folder | Application key (= URL base) | Dev port | Family |
| --- | --- | --- | --- |
| `agriculture-livestock-mapping-app` | `agriculture-livestock` | 5174 | env |
| `health-mapping-app` | `health-mapping` | 5175 | infra |
| `local-government-mapping-app` | `local-government-mapping` | 5176 | pop |
| `land-administration-app` | `land-administration` | 5177 | pop |
| `population-mapping-app` | `population-mapping` | 5178 | pop |
| `trade-mapping-app` | `trade-mapping` | 5179 | pop |
| `disaster-emergency-mapping-app` | `disaster-emergency-mapping` | 5180 | infra |
| `infrastructure-mapping-app` | `infrastructure-mapping` | 5181 | infra |
| `mining-sites-mapping-app` | `mining-sites` | 5182 | env |
| `environment-mapping-app` | `environment-mapping` | 5183 | env |
| `water-resources-mapping-app` | `water-resources` | 5184 | env |
| `parks-operations-mapping-app` | `parks-operations` | 5185 | env |
| `education-mapping-app` | `education-mapping` | 5186 | pop |

"Family" means the apps share a code lineage. A fix made in one app usually
has to be ported to the rest of its family; see
[architecture.md § App families](docs/architecture.md#6-app-families).

The deployed folder name **must equal the application key**. For example, mining
is served at `/mining-sites/`, not `/mining-sites-mapping/`. Otherwise the page
loads blank.

## Quick start (local development)

```bash
# 1. Backend (needs PostgreSQL; see the service README)
cd D:/Esri/runtime-config-service
npm install && npm run prisma:migrate:deploy && npm run start:dev     # :3000

# 2. Any app
cd "C:/Users/user/Downloads/EA Apps/health-mapping-app"
npm install
npm run dev            # https://localhost:5175/health-mapping/
npm test
npm run build:static   # production artifact in dist/
```

Each app needs a `.env` (copy `.env.example`). The `RUNTIME_CONFIG_PROXY_TARGET`
variable in it picks the backend, e.g. `http://localhost:3000` locally or
`https://gh.space.gov.rw` for live config. Restart the dev server after changing
`.env`. More detail is in [docs/operations.md](docs/operations.md).

## Other folders here

`docs/` holds system documentation, config examples (`examples/`) and the
initial config documents used to seed each app (`initial-config/`).

Material that isn't source was moved out of this folder to
`C:\Users\user\Downloads\EA Apps archive\` before it became a git repository:

| Archive folder | Contents |
| --- | --- |
| `source-drops/` | The original zips and `_audit_extract/` the apps were rebuilt from |
| `_backup/` | Dated pre-change file copies (2026-10-10 → 10-14), the history from before git |
| `nested-git/` | The former `.git` folders of agriculture, environment, mining, water and parks, with their GitHub remotes (`github.com/Tresorshingiro/…`) |
| `workspace-scripts/` | One-off migration scripts used while harmonising the apps |
| `app-artifacts/<app>/` | Old deploy zips of `dist/`, superseded dev certificates (`*.bak`), logs |

To look at an absorbed app's old history:
`git --git-dir="…/EA Apps archive/nested-git/<app>.git" log`.

## Never commit

`.env` files, `.certs/` (local TLS keys), portal passwords or tokens, SMTP
credentials. The root `.gitignore` covers these. `.env.example` files must hold
placeholders only. Portal service-account passwords live only in the service
database, encrypted with `PORTAL_CREDENTIAL_ENCRYPTION_KEY`.
