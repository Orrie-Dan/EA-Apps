# Rwanda Space Agency — Environment Mapping

A React launcher portal for Rwanda's national geoportal. It presents six
environmental and natural resource modules (climate, water, parks,
conservation, forestry, mining), ten live mapping applications, and their
capabilities, then hands the user off to the relevant ArcGIS/GeoHub
dashboard (`https://gh.space.gov.rw/...`) in a new tab. All module and
application content is derived from `src/data/modules.js` and guarded by
`scripts/check-data.mjs` so the displayed counts can never silently drift
from the source spreadsheet.

## Getting started

Requires Node 20.

```bash
npm ci
```

Use `npm ci`, not `npm install`. Dependencies are declared with `^` ranges
in `package.json`, so `npm install` is free to pull newer minor versions
than were tested; `package-lock.json` is committed and `npm ci` installs
exactly what it records, reproducibly.

```bash
npm run dev
```

Starts the Vite dev server.

```bash
npm run build
```

Runs `scripts/check-data.mjs` first (the build fails if the data guard
fails), then produces a production build in `dist/`.

```bash
npm test
```

Runs the Vitest suite (AuthContext, Counter, SignInView, ModuleView).

## Deploying

`dist/` is a static bundle. The app uses `HashRouter`, so every route lives
in the URL fragment (`#/module/water`) and is resolved entirely client-side
— any static host (S3, Nginx, GitHub Pages, etc.) can serve it with no
server-side rewrite rules or route configuration at all. Upload the
contents of `dist/` and it works.

## Changing module content

Edit `src/data/modules.js` (module metadata, applications, accents) and/or
the generated feature list. Then run:

```bash
npm run check:data
```

This asserts both the aggregate totals (6 modules, 10 applications, 51
features) and the per-module application/feature counts against the source
spreadsheet, so a change that moves content between modules — not just one
that changes the totals — will be caught. It also runs automatically as
part of `npm run build`.

## Images

`public/images/` is **generated and committed**. The client never needs to
run the image pipeline — the portal works out of the box from a fresh
checkout.

To swap a photograph:

1. Edit the relevant source path in `SOURCES` in `scripts/prepare-images.py`
   (each slug maps to a source file and a crop bias).
2. Rerun the pipeline:

   ```bash
   python3 scripts/prepare-images.py
   ```

   This regenerates the WebP files in `public/images/` at each configured
   width, **and** regenerates `src/config/image-manifest.js` — the manifest
   is generated output, do not hand-edit it.

`src/config/images.js` reads the available widths for a slug from that
manifest at `srcSet()`-build time. It must never hardcode widths itself:
the widths that exist differ per image (see the forestry note below), and
the manifest is the single source of truth for what was actually written
to disk.

**Known limitation — forestry resolution.** The forestry source
photographs are only 960×600 px. Encoding above that width would invent
detail that isn't in the source, so `prepare-images.py` caps forestry
output at a single 640px width for both `forestry-card` and
`forestry-hero` (every other slug gets 640/1280/[1920] widths). This means
forestry images are the softest in the portal at large display sizes. A
replacement Nyungwe canopy photograph at 1600px or wider would remove this
limitation entirely — swap it in via the same procedure above.

The pipeline also enforces a first-paint transfer budget (currently
~603 KB, must stay under 1 MB — `srcset` means a browser only ever fetches
one width per image, so this is the number that matters, not disk usage)
and a 7 MB total-on-disk sanity ceiling (currently ~5.99 MB). Both are
checked by the script itself on every run.

## Fonts

Archivo (display) and Inter (UI/body) are self-hosted as variable woff2
files under `public/fonts/`, referenced by `@font-face` rules at the top of
`src/index.css`. The portal makes no font CDN calls at runtime and works
fully offline.

## Authentication

The portal has no sign-in of its own, by design.

Every dashboard is served from `gh.space.gov.rw` and is access-controlled by
ArcGIS Enterprise there. A login page on this site could not change that: a
cross-origin iframe is sealed by the browser, so nothing this application does
can authenticate an embedded GeoHub dashboard. A local sign-in form would have
been decorative.

The flow is:

1. The user opens the portal and browses modules freely.
2. On opening their first dashboard, GeoHub prompts them to sign in - or they
   click **Sign in to GeoHub** in the header beforehand.
3. That sets GeoHub's session cookie, and every subsequent dashboard loads
   without asking again.

**Deployment requirement.** For step 3 to hold, this portal must be hosted on a
subdomain of `space.gov.rw` (for example `envmapping.space.gov.rw`). The embedded
frames are then *same-site* with `gh.space.gov.rw` and its session cookie is sent
normally. Hosted anywhere else - including `localhost` during development - the
cookie is third-party, modern browsers block it, and **every dashboard will
re-prompt**. That is browser policy, not a defect in this code.

**The simplest improvement available.** All nine linked items are currently
private on GeoHub; an anonymous request to each returns "You do not have
permissions to access this resource". If the GeoHub administrator shares them
with **Everyone**, the dashboards embed with **no login at all**. That is one
administrative change and it removes this problem entirely.

If the items must stay restricted and you also want the portal itself to know
who the user is, the next step is ArcGIS Enterprise OAuth 2.0, which requires RSA
to register this application and issue a `client_id`:

```
authorize  https://gh.space.gov.rw/portal/sharing/rest/oauth2/authorize
token      https://gh.space.gov.rw/portal/sharing/rest/oauth2/token
self       https://gh.space.gov.rw/portal/sharing/rest/community/self
```

OAuth alone does **not** fix the cookie problem above - same-site hosting is
required either way.

## Outstanding items

- None for fonts — Archivo and Inter were successfully downloaded and are
  self-hosted in `public/fonts/`.
- The forestry resolution limitation described above remains until a
  higher-resolution source photograph is supplied.
