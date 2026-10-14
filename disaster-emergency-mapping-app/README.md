# Disaster and Emergency Response Mapping

Vite + React full-screen GeoHub workspace. Mapping apps load in the workspace pane (same-origin `/dashboards/...` pages) so Portal’s `X-Frame-Options` does not block them. There is no Hub login; a secured ArcGIS app may still prompt for Portal sign-in inside the pane.

```bash
npm install
npm run dev
```

Open **https://localhost:5173/** (not http). On first visit, accept the self-signed certificate warning.
