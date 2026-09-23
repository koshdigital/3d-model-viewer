import * as THREE from 'three'
import { useStore } from './store.js'
import { decode, parseModel } from './loaders.js'

// Converts legacy materials (FBX/OBJ/3DS load as Phong/Lambert) to PBR so they
// respond to the environment lighting, and makes faces double-sided so cut
// sections show the interior.
function toStandard(m, cache) {
  if (cache.has(m)) return cache.get(m)
  let s = m
  if (!m.isMeshStandardMaterial) {
    s = new THREE.MeshStandardMaterial({
      name: m.name,
      color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
      map: m.map ?? null,
      normalMap: m.normalMap ?? null,
      alphaMap: m.alphaMap ?? null,
      emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0),
      emissiveMap: m.emissiveMap ?? null,
      opacity: m.opacity ?? 1,
      transparent: !!m.transparent,
      vertexColors: !!m.vertexColors,
      roughness: m.shininess != null ? THREE.MathUtils.clamp(1 - Math.sqrt(m.shininess) / 10, 0.15, 0.95) : 0.7,
      metalness: 0,
    })
  }
  s.side = THREE.DoubleSide
  s.clipShadows = true
  cache.set(m, s)
  return s
}

// Centers the model on the ground (y = 0) and returns its bounds.
export function prepare(raw, zUp) {
  raw.rotation.set(zUp ? -Math.PI / 2 : 0, 0, 0)
  raw.position.set(0, 0, 0)
  const root = new THREE.Group()
  root.add(raw)
  root.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(raw)
  const c = box.getCenter(new THREE.Vector3())
  raw.position.set(-c.x, -box.min.y, -c.z)
  root.updateMatrixWorld(true)

  const cache = new Map()
  raw.traverse((o) => {
    if (!o.isMesh) return
    o.castShadow = o.receiveShadow = true
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals()
    if (!o.userData.orig) {
      o.userData.orig = Array.isArray(o.material) ? o.material.map((m) => toStandard(m, cache)) : toStandard(o.material, cache)
    }
    o.material = o.userData.orig
  })

  const b = new THREE.Box3().setFromObject(root)
  const bounds = {
    min: b.min.clone(),
    max: b.max.clone(),
    center: b.getCenter(new THREE.Vector3()),
    radius: b.getBoundingSphere(new THREE.Sphere()).radius || 1,
  }
  return { root, bounds }
}

const storeKey = (name) => `annot:${name}`

export function saveAnnotations() {
  const { modelName, annotations, zUp } = useStore.getState()
  if (!modelName) return
  try {
    localStorage.setItem(storeKey(modelName), JSON.stringify({ zUp, annotations }))
  } catch {}
}

// Local edits win; otherwise fall back to the published <name>.annotations.json.
async function loadSaved(name, notesUrl) {
  try {
    const local = localStorage.getItem(storeKey(name))
    if (local) return JSON.parse(local)
  } catch {}
  if (notesUrl) {
    try {
      const r = await fetch(notesUrl)
      if (r.ok) return await r.json()
    } catch {}
  }
  return null
}

export async function resetToPublished() {
  const { models, modelIndex, modelName } = useStore.getState()
  try {
    localStorage.removeItem(storeKey(modelName))
  } catch {}
  const m = models[modelIndex]
  const saved = m?.notes ? await loadSaved(modelName, `models/${m.notes}`) : null
  useStore.setState({ annotations: saved?.annotations ?? [], activeId: null })
}

async function finish(raw, name, notesUrl) {
  const saved = await loadSaved(name, notesUrl)
  const zUp = !!saved?.zUp
  const { root, bounds } = prepare(raw, zUp)
  useStore.setState({
    raw,
    object: root,
    bounds,
    zUp,
    modelName: name,
    annotations: saved?.annotations ?? [],
    activeId: null,
    loading: false,
    error: '',
  })
}

async function run(fn) {
  useStore.setState({ loading: true, error: '' })
  try {
    await fn()
  } catch (e) {
    useStore.setState({ loading: false, error: e?.message || 'Could not load the model.' })
  }
}

export async function loadManifest() {
  try {
    const r = await fetch('models/manifest.json')
    const list = r.ok ? await r.json() : []
    useStore.setState({ models: list })
    if (list.length) loadFromFolder(0)
  } catch {
    useStore.setState({ models: [] })
  }
}

export function loadFromFolder(i) {
  const m = useStore.getState().models[i]
  if (!m) return
  useStore.setState({ modelIndex: i })
  return run(async () => {
    const r = await fetch(`models/${m.file}`)
    if (!r.ok) throw new Error(`Could not fetch ${m.name}.`)
    const raw = await parseModel(decode(await r.arrayBuffer()), m.ext)
    await finish(raw, m.name, m.notes ? `models/${m.notes}` : null)
  })
}

export function loadFromFile(file) {
  if (!file) return
  const ext = file.name.split('.').pop().toLowerCase()
  useStore.setState({ modelIndex: -1 })
  return run(async () => {
    const raw = await parseModel(await file.arrayBuffer(), ext)
    await finish(raw, file.name.replace(/\.[^.]+$/, ''), null)
  })
}

// Rotating the up-axis moves every surface, so existing annotations are dropped.
export function setZUp(zUp) {
  const { raw } = useStore.getState()
  if (!raw) return
  const { root, bounds } = prepare(raw, zUp)
  useStore.setState({ object: root, bounds, zUp, annotations: [], activeId: null })
  saveAnnotations()
}

export function exportAnnotations() {
  const { modelName, annotations, zUp } = useStore.getState()
  const blob = new Blob([JSON.stringify({ zUp, annotations }, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${modelName || 'model'}.annotations.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
