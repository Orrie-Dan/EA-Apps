# Sidebar style guide (for matching across apps)

Use your own theme colors. Match this font, sizing, structure, and behavior so every portal sidebar feels the same.

**Font:** Inter (`Inter, ui-sans-serif, system-ui, sans-serif`), weights 400–800. Icons are Lucide at **16px** (stroke **1.6**; collapse and logout use stroke **1.8**).

**Layout:** Sidebar width **252px**, white background, right edge **1px** border in your soft accent/border color. Brand row has logo **32×32** plus the app name, then a **1px** underline in that same border/accent color under the whole row (padding-bottom **14px** before the line). Collapse sits on the right of that row.

**Type scale:** App name **12.5px / weight 800** / letter-spacing **-0.02em**, colored with your darkest accent. Module/category title **12px / 600** in near-black text. Menu (solution) items **12px**, line-height **16px**, padding **7px 8px**, radius **10px**. Account name **12px / 600**. Logout **13px / 600**. Avatar initials **10px / 700**.

**Color roles (map your palette here):** darkest accent → app name, group icons, active icons, logout hover, collapse icon; mid accent → default menu icons; soft accent/border → brand underline, sidebar edge, footer divider, button borders; active fill + active text → selected menu item; light accent tint → collapse/open button hover background. Optional neutrals: `#0f172a` (titles), `#334155` (links/logout), `#64748b` (captions).

**Hover and active:** Menu item default = mid text + mid-accent icon, no fill. Hover = light/near-white fill, text goes to darkest accent. Active = your active fill background, active text color, weight **600**, icon darkest accent. Collapse/reopen chip = white, **32×32** (mobile menu **34×34**), **1px** soft-accent border, radius **10px**, darkest-accent icon; hover fills with accent tint and border shifts to active fill. Logout has no fill or border; hover only recolors label and icon to darkest accent.

**Account and logout:** Footer separated by **1px** soft-accent top border. **28×28** circular avatar with white initials on a light→mid accent gradient, then the display name, then full-width Logout (`LogOut` icon + label, gap **8px**).

**Collapse behavior:** Desktop open by default; collapse hides the sidebar and shows a matching reopen chip at the top-left of the content area. Mobile uses a menu button; sidebar is off-canvas and closes on navigate or scrim tap. Icons: `PanelLeftClose` (collapse), `PanelLeft` (reopen), `Menu` (mobile).

**One-line rule:** Inter; app name **12.5px/800** in darkest accent with a **1px** accent-border underline under the brand row; menu items **12px**; hover and active use system accents; account **12px/600** and logout **13px/600** that only recolor to darkest accent on hover; collapse is a 32px bordered white chip that tints on hover.
