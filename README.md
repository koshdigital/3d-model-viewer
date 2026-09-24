# 3D Model Viewer

React + three.js viewer for architectural models, with section planes, annotations and
realistic/clay rendering. Works on desktop and mobile.

Live: https://3d-model-viewer-5on.pages.dev/ (Cloudflare Pages, deploys on every push to `main`).

## Features

- **Auto-load:** models in `models/` load on startup; a sidebar dropdown switches between them.
  With no models, a drag-and-drop loader (plus a Browse button for phones) appears.
- **Orbit camera:** smooth damped orbit, zoom toward the cursor with distance limits.
- **Section planes:** X, Y and Z (Z = up) sliders with a flip button. Shown as an outline; cut
  surfaces of solids are filled solid black.
- **Annotations:** numbered points placed precisely on the model. Clicking a number shows its
  note and flies the camera to the view saved with it (position and FOV). Notes, FOV, saved
  view and delete are edited in the Annotations side panel. In "Add annotations" mode, drag a
  number to move it.
- **Render:** realistic (studio / soft interior / daylight presets, brightness, shadows,
  optional ambient occlusion) or clay (plain white).
- **Mobile:** the settings sidebar docks to an icon rail; panels open over the view.

## Run locally

```bash
npm install
npm run dev
```

## Adding models

Put model files in `models/`. Supported: **GLB, GLTF (self-contained), FBX, OBJ, 3DS**.
The first model (alphabetical) loads automatically.

- **SketchUp (.skp) is not supported** in browsers. Export to GLB, FBX or OBJ.
- Prefer **GLB** with embedded textures. FBX/OBJ files that reference external texture files
  load without those textures.
- Keep each file under **25 MB** (Cloudflare Pages' per-file limit).
- If a model loads lying on its side, switch on **Model is Z-up** in the Model panel.

## Publishing annotations

Annotations save in the browser you made them in. To publish them for all visitors:

1. Annotations panel → **Export**. This downloads `<model name>.annotations.json`.
2. Put that file in `models/` next to the model (same base name), commit and push.

A browser that already has its own saved annotations for a model keeps showing those; use
**Reset to published** in the Annotations panel to switch to the published set.

## Deploy

The repo is private and connected to Cloudflare Pages (build command `npm run build`, output
directory `dist`, Node version from `.node-version`). To update the live site:

```bash
git add -A
git commit -m "Update model"
git push
```

## Known limitations

- **Section caps** need solid geometry. Small or thin open pieces (door and window frames,
  cables) and glass are not capped and look hollow where cut; walls with missing faces can
  occasionally show a small gap in the cap.
- **Annotation numbers** stay visible through walls (hiding them would cost performance).
- **Ambient occlusion** is off by default: on some GPUs/browsers it makes rotation stutter.

## About copy protection

The build obfuscates the app code, strips source maps and encodes model files, and the page
blocks right-click and common devtools shortcuts. These deter casual copying only: anything a
browser displays has been downloaded to the visitor's machine. Keeping the repository private
is what protects the source code and the raw model files. See `LICENSE`.
