// Derived from the WebP files actually present in public/images/.
// The widths differ per slug — the forestry photographs are only 960px wide,
// so they cap at 640 — which is exactly why srcSet() reads this manifest
// instead of hardcoding a width list. Regenerate with the parent portal's
// scripts/prepare-images.py if the photographs are replaced.
export const manifest = {
  "parks-card": [
    640,
    1280
  ],
  "parks-hero": [
    640,
    1280,
    1920
  ]
}
