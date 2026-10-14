# Trade Mapping Application

Vite + React portal for markets, trade centres, and cross-border trade.

```bash
npm install
npm run dev
```

Open https://localhost:5179/

## Runtime Config

Trade Mapping loads central configuration from:

`GET {VITE_RUNTIME_CONFIG_URL}/api/v1/config/trade-mapping`

Set in `.env`:

```env
VITE_RUNTIME_CONFIG_URL=http://localhost:3000
```

If unset or the service is unreachable, bundled defaults in
`src/config/defaults.js` are used.

See `docs/runtime-config-consumer-pattern.md` in the workspace root for the
standard integration pattern.

```bash
npm test
npm run lint
npm run build
```
