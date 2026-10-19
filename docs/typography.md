# Shared typography (Runtime Config)

All mapping apps take their text styles from Runtime Config `branding.typography`.
The baseline is the Infrastructure app.

## Where the values come from

1. **Shared default:** the `branding.typography` of the application row with key
   **`shared-theme`** (must be active). `GET /api/v1/config/<appKey>` merges it into
   every app's config.
2. **Per-app override:** an app's own `branding.typography` wins, per role and property.
3. **Built-in fallback:** if neither sets a value, the `:root` block of the shared
   stylesheet (`packages/ui/src/styles.css`) holds the Infrastructure values.

Edit the `shared-theme` row through the admin API like any other application. Apps pick
up the change on their next page load. No rebuild or redeploy is needed.

## Document shape

```json
{
  "branding": {
    "typography": {
      "fontFamily": "Inter, system-ui, sans-serif",
      "body":          { "size": "16px", "lineHeight": "1.55" },
      "sidebarBrand":  { "size": "12.5px", "weight": 800 },
      "navGroup":      { "size": "12px", "weight": 600 },
      "navItem":       { "size": "12px", "weight": 400, "activeWeight": 600 },
      "sidebarAction": { "size": "13px", "weight": 600 },
      "eyebrow":       { "size": "12px", "weight": 500 },
      "button":        { "size": "15px", "weight": 600 },
      "loginTitle":    { "size": "clamp(1.35rem, 2.4vw, 1.85rem)", "weight": 700 }
    }
  }
}
```

| Role | What it styles |
|---|---|
| `sidebarBrand` | App name at the top of the sidebar |
| `navGroup` | Module / group headings in the sidebar |
| `navItem` | Application links in the sidebar (`activeWeight` = selected link) |
| `sidebarAction` | Sign-out / account row in the sidebar |
| `eyebrow` | Small label above titles |
| `button` | Primary buttons (sign in, open) |
| `loginTitle` | Title on the sign-in card |
| `body` | Default text size / line height |

## Rules

- `size`: `12px`, `1rem`, `1.2em`, `2vw`, or `clamp(<len>, <len>, <len>)`.
- `weight`: an integer from 100 to 900.
- `lineHeight`: a unitless number or a length.
- `fontFamily`: font names only (letters, digits, spaces, commas, quotes, hyphens).
  Use fonts the apps already ship (Inter). A name that isn't loaded falls back to the next font in the list.
- The admin API rejects unknown roles and properties, and any other value, when a config is saved.
  The apps also ignore invalid values, so a config document cannot inject CSS.

## Code

- Service: `src/config/typography.ts` (validation, merge), `config.service.ts` (applies `shared-theme`),
  `prisma/seed-data/shared-theme.config.json` (seeded create-only).
- Apps: `src/config/applyTypography.js` (sets the `--type-*` CSS variables before paint, from
  `RuntimeConfigProvider.jsx`), and the `:root` block plus `var(--type-*)` rules in
  `packages/ui/src/styles.css`.
