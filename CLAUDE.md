# dot-pen-viewer — CLAUDE.md

Knowledge base for AI-assisted development on this repository.

---

## Project Overview

**dot-pen-viewer** is a 100% client-side, browser-based viewer for `.pen` design files. It is a companion tool for [pencil.dev](https://pencil.dev) that lets users preview Pencil design files without installing any software. No data is ever collected, stored, or transmitted — all processing runs entirely in the browser.

**Live URL**: https://dot-pen-viewer.naimsolong.com/

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript — no framework |
| Deployment | Cloudflare Workers + Workers Assets |
| Build/CLI | Wrangler ^3.0.0 |
| Runtime dep | `jszip` (loaded dynamically from CDN, only when a ZIP file is opened) |
| ZIP parsing | JSZip (CDN) |
| XML parsing | Browser-native `DOMParser` |

---

## Repository Structure

```
dot-pen-viewer/
├── public/
│   ├── index.html      # Entire application — HTML + CSS + JS (single file, ~1600 lines)
│   └── og-image.svg    # 1200×630 Open Graph / social preview image
├── worker.js           # Cloudflare Worker entry point (44 lines)
├── wrangler.toml       # Cloudflare Workers deployment config
├── package.json        # npm scripts + devDependency on wrangler
├── package-lock.json
├── .gitignore          # Excludes: node_modules/, .wrangler/, dist/
└── CLAUDE.md           # This file
```

**Everything lives in `public/index.html`.** There is no build step for the frontend — it is served as-is.

---

## Commands

```bash
npm run dev      # Local dev server via Wrangler (http://localhost:8787)
npm run deploy   # Deploy to Cloudflare Workers
npm run preview  # Quick static preview with npx serve public
```

No test suite is configured. No linting is configured.

---

## Architecture

### Single-file Application

The entire frontend (`public/index.html`) contains:
- All CSS (inline `<style>`)
- All HTML markup
- All JavaScript (inline `<script>`, ~1000 lines)

Do not split this into separate files unless explicitly asked. Keep edits within `index.html`.

### Cloudflare Worker (`worker.js`)

Minimal router that:
1. Serves `og-image.svg` with correct `image/svg+xml` content-type + 24h cache header for social crawlers
2. Serves other static assets from the `ASSETS` binding (Workers Assets)
3. Falls back to `index.html` for any unmatched path (SPA pattern)

Do not add server-side business logic here — the "client-only" guarantee must be preserved.

---

## Design System

### Color Palette (CSS Custom Properties)

```css
--bg: #070b14              /* deep navy page background */
--surface: #0d1220         /* card/panel surfaces */
--surface2: #121b2e        /* secondary surfaces */
--surface3: #192338        /* tertiary surfaces */
--border: #1e2d45          /* borders and dividers */
--accent: #00c8e8          /* primary cyan — interactive elements */
--accent-hover: #00deff    /* accent on hover */
--accent-dim: rgba(0,200,232,0.10) /* accent tint backgrounds */
--text: #e8edf5            /* primary text */
--text-muted: #4a6080      /* secondary/muted text */
--error: #ff6b6b           /* error states */
--success: #4ade80         /* success states */
--radius: 6px              /* standard border-radius */
```

### Typography

Font stack: `'SF Mono', 'Fira Code', 'JetBrains Mono', 'Courier New', monospace`

The whole UI intentionally uses a monospace font for the terminal/developer aesthetic.

### Visual Design Language

- Dark navy background with **cyan** (`#00c8e8`) accent (not purple)
- Landing hero: large two-line title — `dot-pen` (white) / `viewer` (cyan)
- Pill tags with bordered style, no filled background
- Dashed-border drop zone (flat, no heavy box)
- Header disclaimer: minimal bordered pill, muted text

---

## Application Layout

```
┌─────────── header ───────────────────────────────────┐
│ [logo] dot-pen viewer  [disclaimer pill]  [← New File]│
├──────────────────────────────────────────────────────┤
│                                                      │
│               #landing  (shown on load)              │
│   .landing-inner (max-width: 560px, margin: auto)    │
│     .hero  ─ label / title / sub / divider / tags    │
│     .drop-zone  ─ drag & drop + Choose File          │
│     .or-divider                                      │
│     .url-section  ─ URL input + Load button          │
│                                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│               #viewer  (shown after file load)       │
│  ┌──────────┬─────────────────────────────────────┐  │
│  │ .sidebar │         .canvas-wrap                │  │
│  │ frame    │  SVG viewport (pan + zoom)          │  │
│  │ list     │  Floating .toolbar (bottom center)  │  │
│  └──────────┴─────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

`#landing` and `#viewer` toggle visibility via the `hidden` attribute.

---

## JavaScript — Key Concepts

### State Variables

```javascript
let penDoc      = null;   // Parsed document object
let frames      = [];     // Top-level frames/pages array
let selectedFr  = null;   // Currently displayed frame
let reusableMap = {};     // { id → node } for reusable components
let zoom        = 1;      // Current zoom (range: 0.05 – 50)
let panX        = 0;      // Current X pan offset (px)
let panY        = 0;      // Current Y pan offset (px)
```

### File Handling Pipeline

```
handleFile(file)
  └─ processBuf(arrayBuffer, name)
       ├─ [ZIP header 0x50 0x4B] → processZip()
       │     ├─ content.xml     → openXmlDoc()  (Evolus Pencil doc)
       │     ├─ Definition.xml  → openStencilXml() (Evolus Stencil)
       │     └─ *.pen inside ZIP → processJson()
       └─ [other] → processJson() → openDoc()
```

### Rendering Pipeline

```
renderSelectedFrame()
  └─ sets SVG width/height/viewBox, clears contents
       ├─ fr._evolusPage     → renderEvolusPage()  (XML, limited)
       ├─ fr._stencilShapes  → renderStencils()    (stencil grid)
       └─ default            → renderJsonFrame()   (pencil.dev JSON)
                                  └─ renderNode() dispatcher
                                       ├─ rectangle, ellipse, line, polygon, star, path
                                       ├─ text
                                       ├─ frame / canvas / group / boolean_operation
                                       ├─ ref (references reusableMap)
                                       ├─ note / context / prompt (sticky note style)
                                       ├─ iconFont
                                       └─ image (data URIs work; external may fail CORS)
```

### Color Resolution

Supported fill/stroke formats:
- CSS hex / rgb / rgba strings: `"#ff0000"`, `"rgba(255,0,0,0.5)"`
- RGBA object (0–1 normalized): `{ r: 1, g: 0, b: 0, a: 0.5 }`
- Gradient object: `{ type: 'linear'|'radial', stops: [...] }`
- Design tokens: `"$color.primary"` → resolved via `THEME` map
- Strings `"none"` / `"transparent"` pass through

### GitHub URL Transform

Any `github.com/.../blob/...` URL is automatically rewritten to `raw.githubusercontent.com/...` before fetching.

### Keyboard Shortcuts (viewer active)

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in (+0.15) |
| `-` | Zoom out (−0.15) |
| `0` | Fit to screen |
| `1` | Reset to 100% (1:1) |
| `↑` / `←` | Previous frame |
| `↓` / `→` | Next frame |

---

## Supported File Formats

| Format | Detection | Renderer |
|--------|-----------|----------|
| pencil.dev JSON (`.pen`) | JSON parse | `renderJsonFrame()` |
| Evolus Pencil ZIP (`.pen`, `.epz`, `.ep`) | ZIP header + `content.xml` | `renderEvolusPage()` (limited) |
| Evolus Stencil ZIP | ZIP header + `Definition.xml` | `renderStencils()` |
| `.pen` JSON inside a ZIP | ZIP header + `*.pen` inside | `renderJsonFrame()` |

---

## Deployment

**Provider**: Cloudflare Workers
**Config**: `wrangler.toml`
**Custom domain**: `dot-pen-viewer.naimsolong.com` (zone: `naimsolong.com`)
**Assets binding**: `ASSETS` ← `./public`

```toml
# wrangler.toml summary
main = "worker.js"
compatibility_date = "2024-09-23"

[assets]
binding = "ASSETS"
directory = "./public"

[[routes]]
pattern = "dot-pen-viewer.naimsolong.com/*"
zone_name = "naimsolong.com"
```

Deploy with: `npm run deploy`

---

## Key Constraints & Conventions

1. **No server-side processing** — The "client-only" guarantee is a core feature. Do not add API calls, data persistence, or tracking.

2. **Single HTML file** — All CSS, HTML, and JS live in `public/index.html`. Do not create separate `.css` or `.js` files unless the user explicitly requests a build system.

3. **No frontend framework** — Keep it vanilla JS. No React, Vue, Svelte, etc.

4. **JSZip is loaded lazily** — Only fetched from CDN when a ZIP file is actually opened. Do not import it at page load.

5. **Reusable components** — Nodes with `reusable: true` + `id` are collected into `reusableMap` before rendering. `{ type: 'ref', ref: 'id' }` nodes resolve against this map.

6. **Virtual frame fallback** — If a doc has no top-level frames, all children are wrapped in a single virtual frame. The bounding box is computed from `boundingBox()`.

7. **Evolus support is limited** — Full Evolus Pencil rendering requires the desktop app. The viewer shows a best-effort SVG import or a text listing.

8. **CORS on images** — External image `src` attributes are set directly on SVG `<image>` elements. They will fail silently if the server doesn't allow CORS. Data URIs always work.

9. **`[hidden]` attribute** — Visibility toggling uses the HTML `hidden` attribute + `[hidden] { display: none !important; }` CSS rule. Do not use `.hide` / `.show` class patterns.

10. **Meta tags** — Favicon, `theme-color`, and OG image still reference the old purple color (`#7c6bff`). Update them when the branding is considered final.

---

## Common Tasks

### Change accent color
Update `--accent` and `--accent-hover` in `:root` in `public/index.html`. Also update `--accent-dim` (rgba version of the accent). The logo-mark gradient (`linear-gradient(135deg, ...)`) in `.logo-mark` may also need updating.

### Add a new shape type
In `renderNode()`, add a new `case` and write a corresponding `renderXxx(node, defs, ox, oy)` function. Follow the pattern of existing renderers: create an SVG element with `svgEl()`, apply `fillAttr()`, `strokeAttrs()`, `opacityAttr()`, and wrap in `withRotation()` if needed.

### Add a new file format
1. In `processZip()` or `processBuf()`, add detection logic
2. Create an `openXxxDoc()` function that builds a normalized `doc` object
3. Add a `_xxxFormat` marker on the frame object
4. Add a renderer in `renderSelectedFrame()` and a `renderXxx()` function

### Modify the landing page
Edit the `.hero`, `.drop-zone`, `.or-divider`, and `.url-section` blocks in `public/index.html`. The `.landing-inner` wrapper (max-width: 560px, centered) contains all landing content.

### Add a new keyboard shortcut
Add a new `if (e.key === '...')` branch in the `keydown` event listener near the bottom of the `<script>` block. Only active when `#viewer` is visible.
