# Health Mapping

Vite + React full-screen GeoHub workspace. Sign in with a GeoHub username and password. Mapping apps load from same-origin `/dashboards/...` pages so Portal’s `X-Frame-Options` does not block them.

```bash
npm install
npm run dev
```

Open **https://localhost:5175/** (not http). On first visit, accept the self-signed certificate warning. Sign in again after switching from HTTP — previous cookies will not apply.
