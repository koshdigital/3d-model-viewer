import { create } from 'zustand'

export const isMobile = window.matchMedia('(max-width: 768px)').matches

const axis = () => ({ on: false, t: 0.5, flip: false })

export const useStore = create((set) => ({
  // model
  models: [],
  modelIndex: -1,
  modelName: '',
  raw: null, // parsed object as loaded
  object: null, // prepared root placed in the scene
  bounds: null, // { min, max, center, radius }
  zUp: false,
  loading: false,
  error: '',

  // section planes (UI axes: z = up)
  clip: { x: axis(), y: axis(), z: axis() },

  // annotations
  annotate: false,
  annotations: [],
  activeId: null,

  // rendering
  // AO off by default: N8AO is known to stall rotation on some GPUs/browsers (see Viewer.jsx).
  render: { mode: 'realistic', preset: 'studio', brightness: 0.35, ao: false, shadows: true },
  fov: 45,

  // camera functions registered by the viewer
  cam: null,

  set: (p) => set(p),
  setClip: (a, patch) => set((s) => ({ clip: { ...s.clip, [a]: { ...s.clip[a], ...patch } } })),
  setRender: (patch) => set((s) => ({ render: { ...s.render, ...patch } })),
  updateAnnotation: (id, patch) =>
    set((s) => ({ annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
}))
