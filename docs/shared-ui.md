# Shared UI (`packages/ui`, `@ea/ui`)

All 13 mapping apps draw the same screens from one package, so they look and
behave alike. The design is the Infrastructure Mapping app's. Each app keeps
only its identity: accent colour, logo or brand icon, name, and login photo.

## What is shared

| Piece | Export |
| --- | --- |
| Login screen (photo + sign-in card) | `LoginPage` |
| Signed-in frame (workspace, or legal page with header and footer) | `Layout` |
| Sidebar + content pane | `Workspace`, `WorkspaceSidebar` |
| Home / module redirects, legal pages | `HomePage`, `ModulePage`, `LegalPage` |
| Content-pane states | `ViewerFrame`, `ViewerLoading`, `ViewerMessage`, `ViewerError` |
| App mark, icons | `LogoMark`, `IconMark` |
| Styles, self-hosted Inter font | `@ea/ui/styles.css` |

The sidebar handles every catalog shape the apps use: a module with a flat list,
named groups, `untitled` modules, and a data-collection form nested under its
dashboard (`solution.form`). It shows the signed-in user's name when known.

**Not shared:** sign-in, portal tokens, proxies and the logic that picks what to
frame (`AppViewer.jsx`). These differ per app and stay in each app. `AppViewer`
only uses the shared `Viewer*` components to draw its states.

## How an app plugs in

Each app has one adapter, `src/shell.jsx`. It wraps the router in
`ShellProvider` and maps the app's own hooks onto one contract:

```jsx
<ShellProvider
  config={useRuntimeConfig()}          // resolved runtime config
  auth={{ checking, authenticated, user: { name }, signIn, signOut }}
  appPath={appPath}                    // prefixes the app base path
  logo={appIcon}                       // optional image; otherwise brandIcon on an accent tile
  brandIcon="leaf"
  theme={{ accent: '#0f766e' }}        // one colour; shades are derived
  firstSolutionOf={fn}                 // optional: which app a module opens on
>
```

`signIn(username, password)` must reject with an `Error` whose message is shown
on the login card. The env-family apps' `signIn` returns `{ ok, error }`, so
their adapter converts it.

`main.jsx` imports `@ea/ui/styles.css`. Apps have no `index.css` of their own.

## Colour

An app sets one `accent`. `styles.css` derives the other shades with
`color-mix()`: sidebar icons, borders, hover/active fills, button hover, focus
rings. An app with a tuned palette can pin any shade (`mid`, `soft`, `tint`,
`activeFill`, `activeText`), as infrastructure, health and disaster do.
`applyTheme` accepts plain colours only (hex, `rgb()`, `hsl()`), so a value
from config cannot inject CSS.

The accent is used for text (the sidebar brand name, the active row), so it
needs 4.5:1 contrast on white.

Typography stays in Runtime Config (`branding.typography`, see
[typography.md](typography.md)). `styles.css` holds the defaults.

## Linking and builds

Each app depends on `"@ea/ui": "file:../packages/ui"`. `npm install` links it,
and each app keeps its own `node_modules` and lockfile, so build and deploy
steps are unchanged (`npm run build:static` in the app folder).
`vite.config.js` (and `vitest.config.js` where present) sets
`resolve.dedupe` for React, React Router and lucide-react, so the linked
package uses the app's single copy of each.

The package is plain JSX that Vite compiles inside each app. It has no build step.

## Changing the look

1. Edit `packages/ui/src`. Run its tests: `cd packages/ui && npm test`
   (`npm install` there once first).
2. Run the tests of a few apps from each family. Restart running dev servers
   only if you change a Vite config. Style and component edits hot-reload.
3. Rebuild and redeploy every app (`npm run build:static`). The package is
   compiled into each app's bundle.

Do not restyle one app on its own. Put the change in the package, or add an
option to `ShellProvider` if apps genuinely need to differ.
