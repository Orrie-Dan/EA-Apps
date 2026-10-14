# Prompt: embed private ArcGIS Enterprise apps (Experience Builder, Dashboards, Hub) in a React workspace

Hand this whole file to the agent working on the other portal app. It contains the
symptoms, the three separate root causes, the working implementation, and a
troubleshooting section for the `Item does not exist or is inaccessible` error.

---

## The prompt

> I have a Vite + React workspace that embeds ArcGIS Enterprise apps in an
> `<iframe>`. Some embeds show their layout but no data, and one crashes during
> boot. I need the apps working **inside the iframe** — opening them in a new tab
> is not an acceptable answer.
>
> Below is the exact diagnosis and fix that worked on an identical setup
> (`district-infrastructure-app`, Vite dev server on `https://localhost:5175`,
> ArcGIS Enterprise 11.4 portal at `https://infrastructure.space.gov.rw`).
> Reproduce the same architecture for my portal, then verify with the commands in
> the "Verification" section. Do not use token injection into cross-origin
> iframes, `draft=true`, iframe `sandbox`, `orgurl`, or a client secret in any
> `VITE_*` variable — all of those were tried and all of them failed.

---

## 1. Symptoms

| Symptom | What it actually means |
| --- | --- |
| App shell/layout renders, every widget is empty | The app item is public, its **nested layers are not** |
| `Create data source error ... isSignInError: true` | A data source returned 403 / `Token Required` |
| `{name: 'identity-manager:user-aborted', details: 'originally aborted from exb'}` | Experience Builder detected a cross-origin embed and **aborted its own OAuth** |
| `Item does not exist or is inaccessible` (code 400) | The requesting identity cannot see that id — see §6 |
| `You do not have permissions...` (code 403, `GWM_0003`) | Item exists, identity lacks access |
| `Token Required` (code 499) | A federated server (`/server/rest/...`) needs a token |
| `GET https://localhost/portal/... ERR_CONNECTION_REFUSED` (no port!) | Hub's authenticated code path stripped the port — see §3.3 |
| `An error occured initializing the HubSite instance` then `Cannot read properties of undefined (reading 'properties')` | Hub's ArcGIS context failed to build — see §3.4 |

### Noise you should ignore

These appear even when everything works. Do not chase them:

- `A listener indicated an asynchronous response by returning true...` — a browser extension
- `[WIREFRAMEIT] - Content Core Script loaded` — a browser extension
- `Register a service worker.` — Experience Builder's own log
- `checkPermission: hub:feature:workspace : not-alpha-org`, `portal: online`, `Notice ... not shown` — Hub feature flags
- `POST https://cognito-identity-fips.us-east-1.amazonaws.com/ 400`, `Error calling AWS` — Hub telemetry
- `getByCollection() fn is deprecated` — Hub deprecation warning

---

## 2. The wrong turns (do not repeat these)

All of these were tried and all failed:

- Making the Experience / Hub **item** public. Not enough: nested layers, groups and cards stay org-only.
- `draft=true` on the Experience URL — owner-only.
- `iframe allow="popup"` — not a valid permission-policy feature.
- `iframe sandbox="..."` — makes the app abort OAuth even harder.
- Injecting a token from a *different* portal into the iframe URL.
- `arcgis-auth-origin=<workspace origin>` — Experience Builder still aborts.
- Registering a new OAuth app and using its client id in the SPA — the embedded apps do not use your client id; they start their own sign-in.
- Putting `PORTAL_CLIENT_SECRET` or a `PORTAL_TOKEN` in a `VITE_*` variable — Vite ships those to the browser. **Never do this.**
- Opening the apps in a new tab. Works, but is not an embed.

---

## 3. Root causes (there are four, and they stack)

### 3.1 Cross-origin embeds abort their own sign-in

Dashboards and Survey123 can run from a plain public URL. **Experience Builder
and Hub cannot finish an organization sign-in inside a cross-origin iframe.** When
the parent is `https://localhost:5175` and the app is on
`infrastructure.space.gov.rw`, the browser treats it as a third-party frame and
the app deliberately aborts OAuth (`originally aborted from exb`). The public
shell renders; every private request then 403s.

**Fix:** stop embedding cross-origin. Mirror the portal onto *your own origin* at
**identical paths** (§4).

### 3.2 Nested content is private even when the app item is public

Verify each layer separately. In the reference case:

| Item | Anonymous | With token |
| --- | --- | --- |
| Experience `a7ed028b...` (Web Experience) | `access: public` | — |
| `Huye Imihigo 2025` `58eba2ae...` | **403** | 13 features |
| `Imihigo_achievements_2025` `9d47c081...` | FeatureServer **499 Token Required** | 29 features |
| `Imihigo_indicators` `60beaf8d...` | 499 | 141 features |
| Hub site `f52aa9b5...` | `access: org` | loads |
| Hub content group `4ea165cd...` | 403 | 57 items |

**Fix:** attach a **server-side** token to mirrored REST requests. It never
reaches the browser.

### 3.3 Hub strips the port when it thinks it is signed in

This is a bug in Hub's own `opendata-ui` bundle:

```js
// opendata-ui: appSettings.portalUrl
portalUrl: Ember.computed("portalHostname", "session.isAuthenticated", function () {
  let e = this.envAppBaseUrl
  if (this.get("session.isAuthenticated")) {
    let t = this.get("session.portalHostname").replace(/:\d*/, "") // strips ":5175"
    // only re-adds a port if portal.httpsPort !== 443
    ...
  } else {
    // anonymous branch — correct, keeps the port
    this.isPortal && (e = `${window.location.origin}/${window.location.pathname.split("/")[1]}`)
  }
  return e
})
```

If `portals/self` reports a **user**, Hub takes the authenticated branch, strips
`:5175`, and — because the portal's `httpsPort` is 443 — requests
`https://localhost/portal/...`, which is refused. The anonymous branch uses
`window.location.origin` and is correct.

**Fix:** never let the identity endpoints report a user.

### 3.4 ...but Hub still needs those endpoints to return 200

Making the identity endpoints fully anonymous fixes the port but breaks Hub a
different way. Anonymous `community/self` answers **400**, Hub's ArcGIS `context`
never builds, and then:

```js
const e = convertModelToSite(s, this.context.hubRequestOptions) // throws: context undefined
const n = await t.HubSite.fromJson(e, this.context)
this.set("currentSite", n)
// caught → Logger.error("An error occured initializing the HubSite instance ...")
```

`currentSite` is never set, so `getFollowButtonConfig` reads `.properties` of
`undefined`. That unhandled rejection kills the Ember render — the trailing
`Cannot read properties of undefined (reading 'outlets')` is the last domino.

**Fix — the key insight:** send an **app token** (client credentials) to the
identity endpoints. An app token answers **200 with `appInfo` and no `user`**,
satisfying both constraints at once. Send the **user token** everywhere else.

| Endpoint group | Token | Why |
| --- | --- | --- |
| `portals/self`, `community/self`, `community/users/*` | **app** | 200, but no user → Hub keeps the good URL branch *and* builds a context |
| everything else under `/sharing/`, `/server/`, `/arcgis/` | **user** | unlocks private items **and groups** |
| `oauth2/*`, `generateToken`, `signin`, `oauth-callback`, `platformSelf` | **none** | a token makes the portal reject the exchange |

**App tokens cannot read groups; only user tokens can.** Hub uses a group as its
content catalog, so a user token is mandatory if you need Hub.

---

## 4. The architecture that works

Mirror the portal onto your own origin **at the portal's own paths**:

```
https://localhost:5175/portal/...  ->  https://<portal-host>/portal/...
https://localhost:5175/server/...  ->  https://<portal-host>/server/...
```

Identical paths matter enormously:

- Root-relative URLs in the apps (`/portal/...`, `/server/...`) work untouched.
- The only rewrite needed is swapping the hostname in response bodies.
- The iframe is same-origin with the parent, so nothing aborts OAuth.
- Apps that derive the portal URL from `window.location` compute it correctly.

An earlier attempt that remapped paths to `/api/portal/proxy/<hostkey>/...`
required hundreds of lines of fragile rewriting and still failed. **Do not remap
paths.**

### Iframe URLs

```js
// src/lib/access.js
'imihigo-progress-tracker': {
  embedUrl: '/portal/apps/dashboards/6a04f736ca4c4074ab0f5e4dabb42c70',
},
'imihigo-approval-template': {
  embedUrl: '/portal/apps/experiencebuilder/experience/?id=a7ed028b8dd941fdbf29739bcad01469',
},
'imihigo-reporting-platform': {
  embedUrl: '/portal/apps/sites/#/imihigo-reporting-platform',
},
```

The iframe itself stays plain — **no `sandbox`**:

```jsx
<iframe className="app-frame" title={title} src={src}
        allow="geolocation; microphone; camera; fullscreen" />
```

---

## 5. Implementation

### 5.1 `.env` (server-side only, never `VITE_*`)

```
PUBLIC_ORIGIN=https://localhost:5175

# OAuth app registered ON THE TARGET PORTAL, with PUBLIC_ORIGIN as a redirect URI
PORTAL_CLIENT_ID=...
PORTAL_CLIENT_SECRET=...

# Required for Hub (groups). Omit and you get app-token-only behaviour.
INFRA_USERNAME=...
INFRA_PASSWORD=...
```

Make sure `.env` is gitignored and `.env.example` documents the names only.

### 5.2 Vite does not put `.env` into `process.env`

Vite only exposes `VITE_*`, and only to the client. Server middleware sees
nothing unless you load it yourself. **This silently causes every request to come
back 403** — it cost an entire debugging round.

```js
// vite.config.js
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, root, ''))
  return {
    plugins: [react(), accessServerPlugin()],
    server: { https, port: 5175, strictPort: true },
  }
})
```

### 5.3 Mount the middleware before Vite's own

```js
// server/vite-plugin.js
import { createPortalMirror } from './portal-mirror.js'

export function accessServerPlugin() {
  const mirror = createPortalMirror()
  return {
    name: 'portal-mirror',
    configureServer(server) { server.middlewares.use(mirror) },
    configurePreviewServer(server) { server.middlewares.use(mirror) },
  }
}
```

Also make sure your SPA fallback does not swallow `/portal` and `/server`:

```json
{ "source": "/((?!assets/|portal/|server/).*)", "destination": "/index.html" }
```

### 5.4 `server/portal-mirror.js`

The full working file is in this repo at `server/portal-mirror.js`. The parts
that matter:

```js
const UPSTREAM = 'https://infrastructure.space.gov.rw'
const UPSTREAM_HOST = new URL(UPSTREAM).host
const MIRROR_PREFIXES = ['/portal/', '/server/', '/sharing/', '/arcgis/']

const NO_TOKEN = /\/oauth2\/|generateToken|\/signin|oauth-callback|platformSelf/i
const IDENTITY_PATHS = /\/(?:portals|community)\/self\b|\/community\/users\//i
const TOKEN_PATHS = [/^\/portal\/sharing\//, /^\/sharing\//, /^\/server\//, /^\/arcgis\//]

/** 'app' | 'user' | null */
function tokenKind(pathname) {
  if (NO_TOKEN.test(pathname)) return null
  if (!TOKEN_PATHS.some((re) => re.test(pathname))) return null
  return IDENTITY_PATHS.test(pathname) ? 'app' : 'user'
}

const cache = { app: null, user: null }

async function portalToken(kind, origin) {
  const hit = cache[kind]
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token
  cache[kind] =
    kind === 'app' ? await mintAppToken() : (await mintUserToken(origin)) || (await mintAppToken())
  return cache[kind]?.token || ''
}

function rewriteText(text, origin) {
  const host = new URL(origin).host
  return text
    .replaceAll(UPSTREAM, origin)
    .replaceAll(`http://${UPSTREAM_HOST}`, origin)
    .replaceAll(`https:\\/\\/${UPSTREAM_HOST}`, origin.replace(/\//g, '\\/')) // JSON-escaped
    .replaceAll(encodeURIComponent(UPSTREAM), encodeURIComponent(origin))
    .replaceAll(UPSTREAM_HOST, host) // bare host, e.g. portals/self "portalHostname"
}
```

### 5.5 Six details that will each cost you an hour

1. **The token is referer-bound.** Both grants are tied to `PUBLIC_ORIGIN`, so set
   the upstream `Referer` yourself. With `Referer: https://<portal-host>` the same
   token returns `Invalid token`:
   ```js
   headers.referer = `${origin}/`
   headers.origin = origin
   ```
2. **Strip HTTP/2 pseudo-headers.** Vite's HTTPS dev server is HTTP/2, so
   `req.headers` contains `:method`, `:path`, `:scheme`, `:authority`. Passing
   them to `fetch` throws
   `Headers.append: ":method" is an invalid header name`:
   ```js
   if (key.startsWith(':')) continue
   ```
3. **Rewrite the bare hostname too.** `portals/self.portalHostname` is
   `host/portal` with no scheme, and the apps concatenate it into absolute URLs.
4. **Strip `set-cookie` from mirrored responses.** A portal cookie reaching the
   browser makes the embedded apps believe they are signed in, which re-triggers
   the Hub port bug in §3.3.
5. **Strip framing and encoding headers** — `x-frame-options`,
   `content-security-policy`, `content-encoding`, `content-length`,
   `transfer-encoding`, and the HTTP/2-forbidden `connection`, `keep-alive`,
   `upgrade`, `proxy-connection`. Request `accept-encoding: identity` so you can
   rewrite the body as text. Wrap `res.setHeader` in `try/catch`.
6. **Retry once on an expired token.** The portal answers an expired token with
   **HTTP 200** and an error body, so status codes alone will not tell you:
   ```js
   if (kind && cache[kind] && /"code"\s*:\s*(?:498|499)/.test(buffer.toString('utf8', 0, 256))) {
     cache[kind] = null
     /* re-forward once */
   }
   ```

---

## 6. Troubleshooting `Item does not exist or is inaccessible`

This is portal error **code 400** and it is almost never literal. In order of
likelihood:

### 6.1 You are querying the wrong endpoint for that id type

A **group** id asked for via the items endpoint returns exactly this error.

```
/sharing/rest/content/items/<id>     items only
/sharing/rest/community/groups/<id>  groups only
/sharing/rest/content/groups/<id>/search   a group's items  <-- what Hub uses
```

In the reference case `4ea165cd313b4fa28e4977d57eff9c49` is a **group**. Asked
for as an item it returns `Item does not exist or is inaccessible`; asked for as
a group catalog it returns 57 items. Also note a **layer GUID** such as
`32ceaf6f-7752-4655-97fb-c3e90d64151c` is not an item id — real item ids are 32
hex characters.

Confirm what an id actually is:

```powershell
Invoke-WebRequest "https://<portal>/portal/sharing/rest/search?q=id%3A<id>&f=json" -UseBasicParsing
```

### 6.2 Your token is not being attached at all

Test the same URL with and without a token. If both are identical, the token is
not reaching the request — and if you are on Vite, **the most likely reason is
§5.2**: `process.env` is empty because `loadEnv` was never called. Add a log:

```js
console.log('[mirror]', kind, url.pathname, 'token?', Boolean(token))
```

### 6.3 Your token is referer-bound to a different origin

A token minted for `PUBLIC_ORIGIN` returns `Invalid token` (498) when sent with
any other referer. See §5.5.1. Test explicitly:

```powershell
# works
Invoke-WebRequest "$base/sharing/rest/community/self?f=json&token=$tok" -Headers @{ Referer = 'https://localhost:5175' }
# "Invalid token"
Invoke-WebRequest "$base/sharing/rest/community/self?f=json&token=$tok" -Headers @{ Referer = "https://<portal-host>" }
```

### 6.4 You used an app token where a user token is required

App tokens (`grant_type=client_credentials`) **cannot read groups**. Symptoms:
items and feature services work, `community/groups/<id>` and
`content/groups/<id>/search` return 403, and Hub's catalog is empty. Set
`INFRA_USERNAME` / `INFRA_PASSWORD` so a user token is minted.

### 6.5 The group details endpoint 400s even for its owner

A known portal quirk: `community/groups/<id>` can return
`Group does not exist or is inaccessible` while
`community/groups?q=id:<id>` finds it and `content/groups/<id>/search` returns
its items. The same happens anonymously against the real portal, so it is not
your proxy. Hub only needs the catalog search, so it is harmless.

### 6.6 The item genuinely is not shared

Last resort. Confirm with an authenticated request; if the owner's own token
cannot see it, share it on the portal.

---

## 7. Verification

Run every check against **your own origin**, not the portal. Replace the ids.

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = 0   # self-signed dev cert
$b = 'https://localhost:5175'

# 1. identity endpoints: expect 200, appInfo present, NO user
foreach ($p in '/portal/sharing/rest/portals/self','/portal/sharing/rest/community/self') {
  $j = (Invoke-WebRequest "$b$p`?f=json" -UseBasicParsing).Content | ConvertFrom-Json
  "$p -> user=$(if($j.user.username){$j.user.username}else{'<none>'}) appInfo=$(if($j.appInfo){'yes'}else{'no'})"
}

# 2. private layers: expect real counts, not 403/499
foreach ($s in 'Imihigo_achievements_2025','Imihigo_indicators') {
  (Invoke-WebRequest "$b/server/rest/services/$s/FeatureServer/0/query?where=1%3D1&returnCountOnly=true&f=json" -UseBasicParsing).Content
}

# 3. Hub catalog group: expect total > 0
((Invoke-WebRequest "$b/portal/sharing/rest/content/groups/<groupId>/search?f=json&num=1" -UseBasicParsing).Content | ConvertFrom-Json).total

# 4. no upstream hostname leaks into any response
$r = Invoke-WebRequest "$b/portal/sharing/rest/content/items/<appId>/data?f=json" -UseBasicParsing
([regex]::Matches($r.Content, [regex]::Escape('<portal-host>'))).Count   # must be 0
```

Expected, from the reference fix:

```
/portal/sharing/rest/portals/self   -> user=<none> appInfo=yes
/portal/sharing/rest/community/self -> user=<none> appInfo=yes
{"count":29}
{"count":141}
57
0
```

Then in the browser: open each app and **hard-refresh** (`Ctrl+Shift+R`) — the
old iframe state caches aggressively. Success looks like

- no `identity-manager:user-aborted`
- no `https://localhost/...` requests without a port
- no `An error occured initializing the HubSite instance`
- widgets and cards populated

---

## 8. Known limitations

- **The mirror only runs in the Vite dev/preview server.** A static host has no
  middleware, so no token injection. Deploy the same middleware on a Node server
  or a serverless function. A plain proxy rewrite in `vercel.json` / `_redirects`
  fixes the cross-origin abort but **not** the private data.
- **Anyone who can reach your origin can read the mirrored portal content** using
  the server-side token. Put the mirror behind your app's auth and never expose
  it publicly.
- Items shared as `org` still prompt for sign-in for anyone hitting the portal
  directly; only the mirrored path is unlocked.
- Survey123 needs `referer=https://survey123.arcgis.com` for its own tokens —
  do not reuse the workspace-bound token there.
