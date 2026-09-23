# 3D Model Viewer

React + three.js viewer with section planes, annotations and realistic/clay rendering.

## Run locally

```bash
npm install
npm run dev
```

## Adding models

Put model files in `models/`. Supported: **GLB, GLTF (self-contained), FBX, OBJ, 3DS**.
The first model (alphabetical) loads automatically; the sidebar dropdown switches between them.
With an empty folder, the viewer shows a drag-and-drop loader.

- **SketchUp (.skp) is not supported** in browsers. Export to GLB, FBX or OBJ.
- Prefer **GLB** with embedded textures. FBX/OBJ files that reference external texture files load without those textures.
- Keep each file under **25 MB** if you host on Cloudflare Pages.

## Publishing annotations

Annotations save in the viewer's browser. To publish them for all visitors:

1. Annotations panel → **Export**. This downloads `<model name>.annotations.json`.
2. Put that file in `models/` next to the model (same base name) and redeploy.

## Build & deploy

```bash
npm run build
```

Deploy the `dist/` folder to any static host. Recommended: keep this repo **private** and
connect it to Cloudflare Pages, Netlify or Vercel (all free). Build command `npm run build`,
output directory `dist`.

## About copy protection

The build obfuscates the app code, strips source maps and encodes model files, and the page
blocks right-click and common devtools shortcuts. These deter casual copying only: anything
a browser displays has been downloaded to the visitor's machine. Keeping the repository
private is what protects the source code and the raw model files.
