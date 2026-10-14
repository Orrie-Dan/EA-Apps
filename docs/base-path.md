# Serving the apps under `/<application-key>/`

Every app is served under a base path equal to its Runtime Config application
key, so all twelve can share one host behind a path-routing reverse proxy:

| App folder | Base path | Dev port |
|---|---|---|
| agriculture-livestock-mapping-app | `/agriculture-livestock/` | 5174 |
| health-mapping-app | `/health-mapping/` | 5175 |
| local-government-mapping-app | `/local-government-mapping/` | 5176 |
| land-administration-app | `/land-administration/` | 5177 |
| population-mapping-app | `/population-mapping/` | 5178 |
| trade-mapping-app | `/trade-mapping/` | 5179 |
| disaster-emergency-mapping-app | `/disaster-emergency-mapping/` | 5180 |
| infrastructure-mapping-app | `/infrastructure-mapping/` | 5181 |
| mining-sites-mapping-app | `/mining-sites/` | 5182 |
| environment-mapping-app | `/environment-mapping/` | 5183 |
| water-resources-mapping-app | `/water-resources/` | 5184 |
| parks-operations-mapping-app | `/parks-operations/` | 5185 |

In development each app still runs on its own port, e.g.
`https://localhost:5175/health-mapping/`. Opening the bare origin
(`https://localhost:5175/`) redirects to the base.

## Where the base comes from

- `src/config/application.js` exports `APP_BASE_PATH` (`/${APPLICATION_KEY}`).
  Vite's `base`, the router `basename`, and the client helper
  `src/lib/appPath.js` derive from it. Do not set the base anywhere else.
- `server/base-path.js` strips the base from incoming requests (the server's
  routing stays root-relative) and adds it back to every URL for this origin
  in redirects and in the text bodies the portal proxies rewrite.
- The in-frame patch scripts (`public/**/*-patch.js`) read the base from their
  own script URL.
- `VITE_RUNTIME_CONFIG_URL` must include the base, e.g.
  `https://geohub.example/health-mapping`, because the Runtime Config backend
  is reached through the app (`<base>/api/v1/config`, `<base>/api/v1/portal-auth`).
- `PUBLIC_ORIGIN` stays an origin only (no path). It is what portal tokens are
  bound to.

## What the reverse proxy in front must do

1. **Route each base path to its app, without stripping it.** The app expects
   to see `/health-mapping/...`.
2. **Forward the original host and scheme** (`Host` or `X-Forwarded-Host`, and
   `X-Forwarded-Proto`). The apps build absolute URLs and portal referers from
   them.
3. **Route root-relative portal requests by `Referer`.** ArcGIS apps framed
   inside an app sometimes compute URLs that start at the host root
   (`/sharing/...`, `/portal/...`, `/apps/...`, `/assets/...`, `/server/...`,
   `/arcgis/...`, `/jsapi/...`, `/home/...`, `/cdn/...`). The patch scripts move
   most of them under the base, but the rest still arrive at `/`. Send each one
   to the app whose base path appears in the request's `Referer`
   (`https://host/<base>/...`). The app's server then handles them as it
   always has.
4. Keep cookies at `Path=/`. Each app's cookie names are already unique
   (`health_app_gate`, `derma_session`, ...), and the root-relative requests in
   item 3 need them.

Example for nginx (one app shown; repeat per base path):

```nginx
map $http_referer $geohub_app {
    default                                  "";
    "~^https?://[^/]+/health-mapping/"       health;
    "~^https?://[^/]+/disaster-emergency-mapping/" disaster;
    # ... one line per app
}

upstream health   { server 127.0.0.1:4175; }
upstream disaster { server 127.0.0.1:4180; }

server {
    # ...
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /health-mapping/             { proxy_pass https://health; }
    location /disaster-emergency-mapping/ { proxy_pass https://disaster; }

    # Root-relative requests from framed portal apps (item 3).
    location ~ ^/(sharing|portal|apps|assets|server|arcgis|jsapi|home|cdn)/ {
        if ($geohub_app = "") { return 404; }
        proxy_pass https://$geohub_app;
    }
}
```

## Known limits

- A root-relative request with no usable `Referer` (some web workers, or
  `Referrer-Policy: no-referrer`) cannot be routed by item 3. None was seen
  while testing the Health dashboards, but not every dashboard was checked.
- URLs saved inside portal items that point at an app's old root path (for
  example `https://localhost:5175/api/portal/...`) are only fixed where the
  patch scripts or proxies rewrite them.
