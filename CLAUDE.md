# CLAUDE.md

React 19 + Vite 8 + three.js via @react-three/fiber v9 / drei v10, zustand for state. Plain JS
(no TypeScript). See README.md for features and the deploy flow.

## Layout

- `vite-plugin-models.js` — scans `models/`, serves (dev) or emits (build) each model XOR-encoded
  as `models/m<i>.bin` plus `models/manifest.json`; `<name>.annotations.json` files go out as
  `m<i>.json`. Static hosting can't list folders, so the manifest is how the app finds models.
- `src/key.js` — the XOR key, shared by the plugin and the app.
- `src/loaders.js` — decode + parse per format (GLB/GLTF, FBX, OBJ, 3DS).
- `src/modelService.js` — load, `prepare()` (centre on ground, convert legacy materials to
  MeshStandardMaterial, DoubleSide), annotation persistence (localStorage, else published JSON).
- `src/store.js` — zustand store. `isMobile` is read once at load.
- `src/components/Viewer.jsx` — the whole scene: environment, lights, model, clipping, section
  caps, markers, camera rig, effects.
- `src/components/Sidebar.jsx`, `NoteEditor.jsx` — side panels; annotation editing lives here.
- `src/protect.js` — copy deterrents (right-click, devtools keys).

## Hard-won rules — don't undo these

- **Camera = drei `OrbitControls`, `enableDamping`, `dampingFactor={0.08}`**, matching the user's
  RealEstateSpatialEngine villa Explore view, which they call smooth. Trackball and
  CameraControls were both tried and rejected as "not smooth".
- **Ambient occlusion (N8AO) off by default; `EffectComposer multisampling={0}`.** On this user's
  machine N8AO and composer multisampling caused per-frame WebGL errors and 1–3 fps rotation
  (documented in RealEstateSpatialEngine `apps/viewer/app/viewer/Stage.tsx`).
- **Shadow map updates on demand** (`ShadowUpdater`), not every frame.
- **Markers render into a fixed DOM layer** (`Html portal={layer}`). Without it, drei `Html`
  re-created its React 19 root after the canvas connected events and the layer stayed empty.
- **Section caps need two stencil tests to agree** (inside count + visible back face), per piece
  of geometry, skipping thin/small open pieces. The long comment above `SectionCaps` explains
  why each simpler version failed on real exports. Stencil meshes use `dispose={null}` because
  they share the model's geometry.
- Raycasts ignore clipping planes: filter hits with `visibleHit()`.

## Verifying in the preview pane

- The desktop app's preview pane is often hidden, which pauses `requestAnimationFrame`: animations
  and damping only advance when a screenshot is taken. Take several small screenshots to step
  frames; don't judge smoothness there.
- `isMobile` reflects the pane width at page load; a narrow hidden pane loads the mobile layout.
- For scene inspection, temporarily add `window.__r3f = st` in the Canvas `onCreated` and remove
  it before committing. Setting the cap material colour to red makes cap artifacts easy to spot.
- `npm run build` must pass before committing; `dist/` and `.claude/` are git-ignored.

## Deploy

Private repo `koshdigital/3d-model-viewer`, connected to Cloudflare Pages
(https://3d-model-viewer-5on.pages.dev/). Every push to `main` deploys. Push only when asked.
