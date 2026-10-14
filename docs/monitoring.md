# Monitoring: Status page, alerts, runbook

The Runtime Config service checks the whole chain every few minutes: apps,
portals, certificates, tokens and every configured dashboard item. It shows the
results on the admin **Status** page and emails when something changes.

Code: `runtime-config-service/src/monitoring/` and
`runtime-config-admin/src/pages/StatusPage.tsx`.

## 1. What is checked

The targets are built fresh from the database on every run. Adding an app,
credential or dashboard in the Admin console adds its checks automatically.
Inactive applications and inactive credentials are skipped on purpose.

| Check | Target | Passes when | Source of targets |
| --- | --- | --- | --- |
| **service** | Runtime Config database | DB ping answers | always |
| **app** | Each app's public URL | `GET` returns 200 `text/html` | `MONITOR_APP_URLS` |
| **tls** | Each HTTPS host (portals + apps) | Certificate trusted and ≥ 14 days from expiry | portal credentials + app URLs |
| **portal** | Each portal credential's portal | `GET <portal>/sharing/rest?f=json` answers | active portal credentials |
| **token** | Each (app, host key) pair | The real broker issues a token (credential valid, portal reachable) | host keys referenced in each active app config |
| **item** | Each `dashboard` / `experience` / `survey123` in each config | The item is readable with that host's token and has the expected type | `modules[].apps[]` in active configs |

Responses slower than 3 s count as a warning. A certificate within 14 days of
expiry is a warning, and within 3 days or already expired it fails. An untrusted
certificate fails. The monitor **never** bypasses TLS verification, so it still
reports the pinned RBC exception as red. The one exception is app URLs on
`localhost`/`127.*`, which skip verification so self-signed dev certificates
can be monitored.

Item checks are read-only. They send `GET /sharing/rest/content/items/<id>`
with the token in a header. Tokens are used in memory only, never stored, and
scrubbed from every stored detail. Monitor tokens are bound to
`MONITOR_REFERER`, so they cannot be reused by a browser.

## 2. Reading the Status page

Admin console → **Status**.

| Colour | Meaning |
| --- | --- |
| **Green** | Passed |
| **Amber** | Warning (slow, wrong item type, certificate expiring), **or failed once** |
| **Red** | Failed **2 runs in a row**. "Failing since" shows when it started. |
| **Grey** | Not monitored, e.g. no `portalHostKey` in config or no token for that host |

Red needs two failures in a row, so one dropped response doesn't raise an
alarm. Each row shows the response time, the 24 h and 7 d uptime, and a detail
message. To see one check's results over time (up to 7 days), call
`GET /api/v1/admin/monitoring/history?checkType=item&targetKey=<key>&hours=168`
as an admin. The page does not show history yet.

**Run now** starts a run immediately. It is limited to 3 per minute and returns
409 while a run is already going. **Send test email** checks the alert setup.

## 3. Configuration (service environment)

| Variable | Default | Meaning |
| --- | --- | --- |
| `MONITOR_ENABLED` | `false` | Turns on scheduled runs. Manual runs work either way. |
| `MONITOR_INTERVAL_MS` | `300000` | Time between runs (min 60000). First run ~15 s after start. |
| `MONITOR_APP_URLS` | none | JSON `{"<appKey>":"<public URL>"}`, e.g. `{"health-mapping":"https://gh.space.gov.rw/health-mapping/"}` |
| `MONITOR_REFERER` | `https://runtime-config-monitor.local` | Origin the monitor's tokens are bound to |
| `MONITOR_CONCURRENCY` | `6` | Parallel checks (1–32) |
| `MONITOR_TIMEOUT_MS` | `10000` | Per-check timeout |
| `MONITOR_RETENTION_DAYS` | `30` | Older runs are deleted |

If `MONITOR_APP_URLS` is invalid JSON, it is ignored, and the Status page shows
why. Results are stored in the `MonitorRun` and `MonitorCheckResult` tables
(migration `20261014120000_add_monitoring`). With several service instances, a
Postgres advisory lock makes sure only one runs each round.

For production, list all 13 apps:

```env
MONITOR_ENABLED=true
MONITOR_APP_URLS={"agriculture-livestock":"https://gh.space.gov.rw/agriculture-livestock/","health-mapping":"https://gh.space.gov.rw/health-mapping/", "...": "..."}
```

## 4. Email alerts

Alerts are off until host, sender and recipients are all set. The service
sends **one email per run, and only when something changed**:

- a check **turns red** (second failure in a row)
- a red check **recovers**
- a certificate **enters** its 14-day warning window
- a **reminder** every `MONITOR_ALERT_REMIND_HOURS` while a check stays red

| Variable | Default | Meaning |
| --- | --- | --- |
| `MONITOR_SMTP_HOST` | none | SMTP server |
| `MONITOR_SMTP_PORT` | `587` | |
| `MONITOR_SMTP_SECURE` | `false` | `true` for implicit TLS (port 465) |
| `MONITOR_SMTP_REQUIRE_TLS` | `true` | Refuse to send without STARTTLS. Set `false` only for an internal relay. |
| `MONITOR_SMTP_USER` / `MONITOR_SMTP_PASSWORD` | none | SMTP login, if required |
| `MONITOR_ALERT_FROM` | none | Sender address |
| `MONITOR_ALERT_TO` | none | Comma-separated recipients |
| `MONITOR_ALERT_REMIND_HOURS` | `24` | 0 = no reminders |
| `MONITOR_STATUS_URL` | none | Link to the Status page, put in every email |

A failing mail server never breaks a run. The last delivery result appears on
the Status page, and is kept in memory only (reset on restart). After setting
these, press **Send test email**.

## 5. Runbook: a check is red

| Check | Detail says | Usually means | Action |
| --- | --- | --- | --- |
| service | Database unreachable | PostgreSQL down or `DATABASE_URL` wrong | Restart or fix the DB; the service itself is up if the page loads |
| app | HTTP 404 | Folder not deployed or named differently from the key | Deploy `dist/` to `/<app-key>/` |
| app | HTTP 502/503, timed out | Web server or ARR down | Check IIS on gh |
| tls | Certificate expired / expires in N days | Owner must renew | Tell the portal owner (RBC, RURA, …). Do not disable verification. |
| tls | Certificate not trusted | Incomplete chain or self-signed certificate | Owner fixes the certificate chain |
| portal | DNS lookup failed / Connection refused / Timed out | **The service's server** can't reach that portal | Network, DNS or firewall on the gh server. The portal may work fine from your PC. |
| token | Invalid username or password | Service-account password changed or locked | Update the credential in Admin → Portal credentials, **Test** it |
| token | Unable to reach ArcGIS Portal | as portal | as portal |
| item | `403 GWM_0003` | Item not shared with the service account | Owner shares the item with it |
| item | `400 CONT_0001` | Item deleted or wrong ID | Get the new item ID, update the app's config |
| item (amber) | Configured as X but the item is Y | `kind` in config doesn't match the item | Fix `kind` in config |

After fixing, press **Run now**. A recovered check turns green straight away
and sends a "recovered" email.

**Known false reds.** Health's Survey123 forms (`d0ccb11c…`, `93a5a69a…`,
`9ea5acc5…`) are opened on survey123.arcgis.com with the user's own sign-in.
The RBC service account can't read them, so they show red while working for
users. `gis.rbc.gov.rw` is red until RBC renews its certificate.

## 6. What the monitor does not catch

- **Rendering inside the browser.** A dashboard can load its item and still fail
  on a layer or web map it references. Spot-check heavy dashboards after changes.
- **Paths through the apps' own dev proxies.** The monitor talks to portals
  directly with broker tokens, not through `/api/v1/portal-proxy`.
- **User sign-in.** The monitor has no user account, so it cannot test
  `app-auth/login`. The `token` check for `gh` covers the portal side of it.

Logs: the service logs the monitor settings at start-up, failed runs, and every
alert email (sent or failed) to stdout, wherever `npm run start:prod` output
goes on the server.
