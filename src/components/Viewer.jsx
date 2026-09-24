import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useStore } from '../store.js'

export const PRESETS = {
  // Key light comes from the camera's left so shadows fall into view.
  studio: { label: 'Studio', env: 0.7, key: 2.2, color: '#ffffff', dir: [-1, 1.5, 0.5], bg: '#9ea5ad' },
  interior: { label: 'Soft interior', env: 1.0, key: 1.2, color: '#fff4e6', dir: [-0.5, 1.8, 0.8], bg: '#a9aeb4' },
  daylight: { label: 'Daylight', env: 0.55, key: 3.2, color: '#fff1dc', dir: [-1.2, 1.1, 0.3], bg: '#b3c0cc' },
}
const CLAY_BG = '#c3c7cc'

// UI axes use Z as "up" (CAD convention); three.js uses Y as up.
const AXES = { x: 'x', y: 'z', z: 'y' }
const UNIT = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }

const clipValue = (bounds, a, t) => THREE.MathUtils.lerp(bounds.min[AXES[a]], bounds.max[AXES[a]], t)

// Unflipped keeps geometry below/behind the plane; flipped keeps the other side.
function useClipPlanes() {
  const clip = useStore((s) => s.clip)
  const bounds = useStore((s) => s.bounds)
  return useMemo(() => {
    if (!bounds) return []
    return Object.keys(clip)
      .filter((a) => clip[a].on)
      .map((a) => {
        const v = clipValue(bounds, a, clip[a].t)
        const n = UNIT[AXES[a]].clone()
        return clip[a].flip ? new THREE.Plane(n, -v) : new THREE.Plane(n.negate(), v)
      })
  }, [clip, bounds])
}

function Env({ intensity }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const tex = pm.fromScene(room, 0.04).texture
    scene.environment = tex
    return () => {
      scene.environment = null
      tex.dispose()
      pm.dispose()
      room.dispose?.()
    }
  }, [gl, scene])
  useEffect(() => {
    scene.environmentIntensity = intensity
  }, [scene, intensity])
  return null
}

function Lights({ preset, brightness, shadows }) {
  const bounds = useStore((s) => s.bounds)
  const ref = useRef()
  const r = bounds?.radius ?? 5
  const c = bounds?.center ?? new THREE.Vector3()
  const pos = new THREE.Vector3(...preset.dir).normalize().multiplyScalar(r * 2.5).add(c)

  useEffect(() => {
    const l = ref.current
    l.target.position.copy(c)
    l.target.updateMatrixWorld()
    const cam = l.shadow.camera
    cam.left = cam.bottom = -r * 1.3
    cam.right = cam.top = r * 1.3
    cam.near = r * 0.1
    cam.far = r * 6
    cam.updateProjectionMatrix()
    l.shadow.bias = -0.0003
    l.shadow.normalBias = r * 0.002
  }, [bounds]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <directionalLight
        ref={ref}
        position={pos}
        intensity={preset.key * brightness}
        color={preset.color}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
      />
      <hemisphereLight args={['#ffffff', '#8d8a86', 0.35 * brightness]} />
    </>
  )
}

// First mesh hit that hasn't been cut away (raycasts ignore clipping planes).
const visibleHit = (hits, planes) =>
  hits.find((h) => h.object.isMesh && planes.every((p) => p.distanceToPoint(h.point) >= 0))

const clayMaterial = new THREE.MeshStandardMaterial({ color: '#d8d8d4', roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
clayMaterial.clipShadows = true

function Model({ planes }) {
  const object = useStore((s) => s.object)
  const mode = useStore((s) => s.render.mode)

  useEffect(() => {
    object.traverse((o) => {
      if (o.isMesh) o.material = mode === 'clay' ? clayMaterial : o.userData.orig
    })
  }, [object, mode])

  useEffect(() => {
    const apply = (m) => (m.clippingPlanes = planes)
    object.traverse((o) => {
      if (o.isMesh) [].concat(o.userData.orig).forEach(apply)
    })
    apply(clayMaterial)
  }, [object, planes])

  const onClick = (e) => {
    const st = useStore.getState()
    // Ignore drags and clicks that landed on a marker rather than the canvas.
    if (!st.annotate || e.delta > 6 || !st.cam || e.nativeEvent.target.tagName !== 'CANVAS') return
    e.stopPropagation()
    const hit = visibleHit(e.intersections, planes)
    if (!hit) return
    const id = Date.now().toString(36)
    st.set({
      annotations: [...st.annotations, { id, p: hit.point.toArray(), note: '', view: st.cam.getView() }],
      activeId: id,
    })
  }

  return <primitive object={object} onClick={onClick} />
}

function Ground({ r }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-r * 0.001} receiveShadow raycast={() => null}>
      <planeGeometry args={[r * 12, r * 12]} />
      <shadowMaterial transparent opacity={0.22} />
    </mesh>
  )
}

function PlaneVisuals() {
  const clip = useStore((s) => s.clip)
  const b = useStore((s) => s.bounds)
  const size = b.max.clone().sub(b.min).multiplyScalar(1.08)
  return Object.keys(clip)
    .filter((a) => clip[a].on)
    .map((a) => {
      const pos = b.center.clone()
      pos[AXES[a]] = clipValue(b, a, clip[a].t)
      const rot = { x: [0, Math.PI / 2, 0], y: [0, 0, 0], z: [-Math.PI / 2, 0, 0] }[a]
      const dims = { x: [size.z, size.y], y: [size.x, size.y], z: [size.x, size.z] }[a]
      return <PlaneOutline key={a} position={pos} rotation={rot} w={dims[0]} h={dims[1]} />
    })
}

// Outline only — the plane itself is fully transparent. Drawn on top so it stays visible.
function PlaneOutline({ w, h, ...props }) {
  const geometry = useMemo(
    () =>
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w / 2, -h / 2, 0),
        new THREE.Vector3(w / 2, -h / 2, 0),
        new THREE.Vector3(w / 2, h / 2, 0),
        new THREE.Vector3(-w / 2, h / 2, 0),
      ]),
    [w, h]
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineLoop geometry={geometry} raycast={() => null} renderOrder={20} {...props}>
      <lineBasicMaterial color="#2f6fed" depthTest={false} transparent />
    </lineLoop>
  )
}

/*
  SECTION CAPS — fills cut faces with solid black. Per plane, a cap pixel needs TWO tests to agree,
  because real exports (open walls with faces deleted, flipped normals) defeat either one alone:

  1. INSIDE COUNT (classic even/odd, as in three.js's webgl_clipping_stencil): along the view
     ray, the model's back faces +1 and front faces -1, clipped by this plane only. Non-zero
     means the ray crosses the cut inside a solid. Fooled by gaps in open meshes, which draw
     stray lines "through" floors — but there the visible surface is the floor's front face.
  2. VISIBLE INSIDE: a cut solid shows its inside, so a back face must be the surface actually
     on screen (drawn after the model, depth-tested against it, clipped like the model). Fooled
     by faces with flipped normals — but there the inside count says "outside".

  Test 2 sets stencil bit 0x80; test 1 counts in the low 7 bits. A black quad on the plane is
  drawn only where both hold (stencil > 0x80), clipped by the other planes; the stencil is then
  cleared for the next plane.

  Only pieces the plane passes through take part, decided per connected piece since exports
  merge many objects into one mesh. Open pieces that are thin or small (cables, door and window
  frames) are skipped: they can't be capped reliably. Transparent groups (glass) are skipped.
*/
const stencilOff = { colorWrite: false, depthWrite: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc }
const INSIDE = 0x80

// Bakes each connected piece's local bounds (center + half size) onto its vertices as the
// `cCenter`/`cHalf` attributes. Vertices are merged by position, since loaders split them at UV
// seams. Runs once per geometry.
function bakePieceBounds(geometry) {
  if (geometry.attributes.cCenter) return
  const pos = geometry.attributes.position
  const n = pos.count
  const ids = new Map()
  const vid = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
    let id = ids.get(k)
    if (id === undefined) ids.set(k, (id = ids.size))
    vid[i] = id
  }
  const parent = new Uint32Array(ids.size).map((_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]]
    return x
  }
  const index = geometry.index
  const tris = index ? index.count : n
  const at = (i) => vid[index ? index.getX(i) : i]
  for (let t = 0; t < tris; t += 3) {
    const a = find(at(t))
    parent[find(at(t + 1))] = a
    parent[find(at(t + 2))] = a
  }
  // A closed solid shares every edge between exactly two triangles. Open pieces can't be capped
  // reliably — small or thin ones (a cable strip, a door or window frame) leave stray black
  // lines — so the shader skips open pieces that are thin or small across the cut. Large open
  // pieces (walls and slabs with a face deleted, common in exports) still get capped.
  const edges = new Map()
  const edge = (a, b) => {
    const k = a < b ? a * ids.size + b : b * ids.size + a
    edges.set(k, (edges.get(k) ?? 0) + 1)
  }
  for (let t = 0; t < tris; t += 3) {
    const a = at(t)
    const b = at(t + 1)
    const c = at(t + 2)
    edge(a, b)
    edge(b, c)
    edge(c, a)
  }
  const open = new Set()
  for (const [k, count] of edges) if (count !== 2) open.add(find(Math.floor(k / ids.size)))

  const min = new Map()
  const max = new Map()
  for (let i = 0; i < n; i++) {
    const r = find(vid[i])
    const lo = min.get(r) ?? [Infinity, Infinity, Infinity]
    const hi = max.get(r) ?? [-Infinity, -Infinity, -Infinity]
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)]
    for (let j = 0; j < 3; j++) {
      lo[j] = Math.min(lo[j], p[j])
      hi[j] = Math.max(hi[j], p[j])
    }
    min.set(r, lo)
    max.set(r, hi)
  }
  const center = new Float32Array(n * 3)
  const half = new Float32Array(n * 3)
  const isOpen = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = find(vid[i])
    const lo = min.get(r)
    const hi = max.get(r)
    isOpen[i] = open.has(r) ? 1 : 0
    for (let j = 0; j < 3; j++) {
      center[i * 3 + j] = (lo[j] + hi[j]) / 2
      half[i * 3 + j] = (hi[j] - lo[j]) / 2
    }
  }
  geometry.setAttribute('cCenter', new THREE.BufferAttribute(center, 3))
  geometry.setAttribute('cHalf', new THREE.BufferAttribute(half, 3))
  geometry.setAttribute('cOpen', new THREE.BufferAttribute(isOpen, 1))
}

// Discards stencil fragments from pieces whose world bounds don't straddle the plane, and from
// open pieces thinner than uThin or smaller than uSmall across it (half-extents; planes are
// axis-aligned: uAxis is the world axis, uValue the plane's position on it).
function onlyCutPieces(material, uniforms) {
  material.customProgramCacheKey = () => 'section-stencil'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader =
      'attribute vec3 cCenter;\nattribute vec3 cHalf;\nattribute float cOpen;\n' +
      'uniform int uAxis;\nuniform float uValue;\nuniform float uThin;\nuniform float uSmall;\nvarying float vCut;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 wc = (modelMatrix * vec4(cCenter, 1.0)).xyz;
        mat3 m = mat3(modelMatrix);
        vec3 we = abs(m[0]) * cHalf.x + abs(m[1]) * cHalf.y + abs(m[2]) * cHalf.z;
        float c = uAxis == 0 ? wc.x : (uAxis == 1 ? wc.y : wc.z);
        float e = uAxis == 0 ? we.x : (uAxis == 1 ? we.y : we.z);
        vec2 across = uAxis == 0 ? we.yz : (uAxis == 1 ? we.xz : we.xy);
        bool skipOpen = cOpen > 0.5 && (min(across.x, across.y) < uThin || max(across.x, across.y) < uSmall);
        vCut = abs(uValue - c) < e && !skipOpen ? 1.0 : 0.0;`
      )
    shader.fragmentShader =
      'varying float vCut;\n' + shader.fragmentShader.replace('void main() {', 'void main() {\n  if (vCut < 0.5) discard;')
  }
}
const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false })
const capQuat = new THREE.Quaternion()
const Z = new THREE.Vector3(0, 0, 1)

function SectionCaps({ planes }) {
  const object = useStore((s) => s.object)
  const bounds = useStore((s) => s.bounds)
  const meshes = useMemo(() => {
    const list = []
    object.updateMatrixWorld(true)
    object.traverse((o) => {
      if (o.isMesh && [].concat(o.userData.orig).some((m) => !m.transparent)) list.push(o)
    })
    list.forEach((m) => bakePieceBounds(m.geometry))
    return list
  }, [object])
  return planes.map((plane, i) => (
    <SectionCap
      key={i}
      order={i + 1}
      plane={plane}
      planes={planes}
      others={planes.filter((p) => p !== plane)}
      meshes={meshes}
      size={bounds.radius * 4}
    />
  ))
}

function SectionCap({ plane, planes, others, meshes, order, size }) {
  const mats = useMemo(() => {
    // Test 2: visible back faces set the INSIDE bit. The offset keeps depths equal to the
    // model's own back faces (same geometry) passing.
    const visible = new THREE.MeshBasicMaterial({
      ...stencilOff,
      side: THREE.BackSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      stencilRef: INSIDE,
      stencilWriteMask: INSIDE,
      stencilZPass: THREE.ReplaceStencilOp,
    })
    // Test 1: count along the whole ray (no depth test) in the low 7 bits.
    const count = (side, op) =>
      new THREE.MeshBasicMaterial({
        ...stencilOff,
        side,
        depthTest: false,
        stencilWriteMask: 0x7f,
        stencilFail: op,
        stencilZFail: op,
        stencilZPass: op,
      })
    const back = count(THREE.BackSide, THREE.IncrementWrapStencilOp)
    const front = count(THREE.FrontSide, THREE.DecrementWrapStencilOp)
    // Passes where INSIDE < stencil: the bit is set and the count is non-zero.
    const cap = new THREE.MeshBasicMaterial({
      color: '#000000',
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: INSIDE,
      stencilFunc: THREE.LessStencilFunc,
    })
    const uniforms = { uAxis: { value: 1 }, uValue: { value: 0 }, uThin: { value: 0 }, uSmall: { value: 0 } }
    for (const m of [visible, back, front]) onlyCutPieces(m, uniforms)
    return { visible, back, front, cap, uniforms }
  }, [])
  useEffect(() => () => [mats.visible, mats.back, mats.front, mats.cap].forEach((m) => m.dispose()), [mats])

  // A mesh can mix opaque and glass materials (common in FBX); skip just the glass groups.
  const materialFor = (m, pass) =>
    Array.isArray(m.userData.orig) ? m.userData.orig.map((x) => (x.transparent ? hiddenMaterial : mats[pass])) : mats[pass]

  // Test 2 is clipped exactly like the model, so it only sees back faces that are on screen.
  mats.visible.clippingPlanes = planes
  mats.back.clippingPlanes = mats.front.clippingPlanes = [plane]
  mats.cap.clippingPlanes = others
  const n = plane.normal
  const axis = Math.abs(n.x) > 0.5 ? 0 : Math.abs(n.y) > 0.5 ? 1 : 2
  mats.uniforms.uAxis.value = axis
  mats.uniforms.uValue.value = -plane.constant / n.getComponent(axis)
  // Half-extents, relative to the model's radius r (size = 4r): thin < 0.2% r, small < 5% r.
  mats.uniforms.uThin.value = size * 0.0005
  mats.uniforms.uSmall.value = size * 0.0125

  const position = plane.coplanarPoint(new THREE.Vector3())
  capQuat.setFromUnitVectors(Z, plane.normal)

  return (
    <>
      {meshes.map((m) =>
        ['visible', 'back', 'front'].map((pass, j) => (
          <mesh
            key={m.uuid + pass}
            geometry={m.geometry}
            material={materialFor(m, pass)}
            // Pinned to the model mesh's world transform (the model is static once prepared).
            ref={(o) => o?.matrixWorld.copy(m.matrixWorld)}
            matrixAutoUpdate={false}
            matrixWorldAutoUpdate={false}
            renderOrder={order + j * 0.01}
            raycast={() => null}
            dispose={null} // shares the model's geometry; must not dispose it on unmount
          />
        ))
      )}
      <mesh
        position={position}
        quaternion={capQuat.clone()}
        material={mats.cap}
        renderOrder={order + 0.1}
        raycast={() => null}
        onAfterRender={(gl) => gl.clearStencil()}
      >
        <planeGeometry args={[size, size]} />
      </mesh>
    </>
  )
}

const stop = (e) => e.stopPropagation()

// Clicking the open marker again hides its note.
const select = (a) => {
  const st = useStore.getState()
  if (st.activeId === a.id) return st.set({ activeId: null })
  st.set({ activeId: a.id })
  st.cam?.goTo(a.view)
}

function Markers({ planes, layer }) {
  const annotations = useStore((s) => s.annotations)
  const activeId = useStore((s) => s.activeId)
  const annotate = useStore((s) => s.annotate)
  const object = useStore((s) => s.object)
  const { camera, gl, controls, raycaster } = useThree()
  const cardRef = useRef()
  const v = useMemo(() => new THREE.Vector3(), [])
  const active = annotations.find((a) => a.id === activeId)

  // Keep the note card on the side of its marker that faces the screen center.
  useFrame(() => {
    const el = cardRef.current
    if (!el || !active) return
    v.fromArray(active.p).project(camera)
    el.classList.toggle('left', v.x > 0.1)
    el.classList.toggle('up', v.y < -0.2)
  })

  // A tap selects the marker; in annotate mode, dragging slides it over the model surface.
  const onPointerDown = (e, a) => {
    stop(e)
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const canDrag = useStore.getState().annotate && object
    if (canDrag && controls) controls.enabled = false
    const ndc = new THREE.Vector2()

    const move = (ev) => {
      if (!canDrag || (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4)) return
      moved = true
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = visibleHit(raycaster.intersectObject(object, true), planes)
      if (hit) useStore.getState().updateAnnotation(a.id, { p: hit.point.toArray() })
    }
    const up = () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      if (canDrag && controls) controls.enabled = true
      if (!moved) select(a)
    }
    // Capture phase, so the marker's own stopPropagation can't swallow these.
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
  }

  return annotations.map((a, i) => (
    <Html key={a.id} portal={layer} position={a.p} center zIndexRange={a.id === activeId ? [1000, 900] : [20, 0]}>
      <button
        className={`marker${a.id === activeId ? ' active' : ''}${annotate ? ' draggable' : ''}`}
        onPointerDown={(e) => onPointerDown(e, a)}
        onPointerUp={stop}
        onClick={(e) => {
          stop(e)
          if (e.detail === 0) select(a) // keyboard activation
        }}
      >
        {i + 1}
      </button>
      {a.id === activeId && (
        <div ref={cardRef} className="note-anchor" onPointerDown={stop} onPointerUp={stop} onClick={stop} onWheel={stop}>
          <div className={`note-bubble${a.note ? '' : ' empty'}`}>{a.note || 'No note yet'}</div>
        </div>
      )}
    </Html>
  ))
}

// The scene is static, so re-render the shadow map only when something that
// affects it changes instead of every frame.
function ShadowUpdater({ planes }) {
  const gl = useThree((s) => s.gl)
  const object = useStore((s) => s.object)
  const render = useStore((s) => s.render)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
  }, [gl])
  useEffect(() => {
    gl.shadowMap.needsUpdate = true
  }, [gl, object, planes, render])
  return null
}

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const bounds = useStore((s) => s.bounds)
  const fov = useStore((s) => s.fov)
  const anim = useRef(null)

  useEffect(() => {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [camera, fov])

  useEffect(() => {
    if (!controls) return
    const V = THREE.Vector3
    const getView = () => ({
      position: camera.position.toArray(),
      target: controls.target.toArray(),
      up: [0, 1, 0],
      fov: camera.fov,
    })
    const goTo = (v, dur = 1) => {
      if (!v) return
      anim.current = {
        t: 0,
        dur,
        from: { p: camera.position.clone(), t: controls.target.clone(), f: camera.fov },
        to: { p: new V(...v.position), t: new V(...v.target), f: v.fov },
      }
    }
    const fitView = () => {
      const b = useStore.getState().bounds
      if (!b) return null
      const f = useStore.getState().fov
      // Fit to the narrower of the vertical/horizontal FOV (portrait phones).
      const half = THREE.MathUtils.degToRad(f) / 2
      const dist = b.radius / Math.sin(Math.atan(Math.tan(half) * Math.min(1, camera.aspect)))
      const p = new THREE.Vector3(1, 0.75, 1).normalize().multiplyScalar(dist).add(b.center)
      return { position: p.toArray(), target: b.center.toArray(), fov: f }
    }
    useStore.setState({ cam: { getView, goTo, fit: (dur) => goTo(fitView(), dur) } })
  }, [camera, controls])

  useEffect(() => {
    if (!bounds || !controls) return
    camera.near = bounds.radius / 500
    camera.far = bounds.radius * 200
    camera.updateProjectionMatrix()
    controls.minDistance = bounds.radius * 0.03
    controls.maxDistance = bounds.radius * 6
    useStore.getState().cam?.fit(0) // jump straight to the model on load
  }, [bounds, controls, camera])

  // Scripted fly-to (annotation views, reset). Ease-in-out cubic, integrated against real time.
  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = a.dur > 0 ? Math.min(1, a.t + dt / a.dur) : 1
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
    camera.position.lerpVectors(a.from.p, a.to.p, k)
    controls.target.lerpVectors(a.from.t, a.to.t, k)
    camera.fov = THREE.MathUtils.lerp(a.from.f, a.to.f, k)
    camera.updateProjectionMatrix()
    controls.update()
    if (a.t >= 1) {
      anim.current = null
      useStore.setState({ fov: a.to.f })
    }
  })
  return null
}

export default function Viewer() {
  const object = useStore((s) => s.object)
  const bounds = useStore((s) => s.bounds)
  const render = useStore((s) => s.render)
  const planes = useClipPlanes()
  const preset = PRESETS[render.preset]
  const clay = render.mode === 'clay'
  const r = bounds?.radius ?? 5
  // Stable DOM layer for markers, mounted before the scene so drei's Html never
  // has to re-create its root (React 19 can leave it empty when it does).
  const layer = useRef(null)

  return (
    <>
    <Canvas
      shadows="percentage"
      gl={{ stencil: true }} // section caps need a stencil buffer
      dpr={[1, 1.5]}
      camera={{ fov: 45, position: [6, 5, 6], near: 0.01, far: 2000 }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
      }}
    >
      <color attach="background" args={[clay ? CLAY_BG : preset.bg]} />
      <Env intensity={preset.env * render.brightness} />
      <Lights preset={preset} brightness={render.brightness} shadows={render.shadows} />
      {object && <Model planes={planes} />}
      {bounds && render.shadows && <Ground r={r} />}
      {bounds && <PlaneVisuals />}
      {object && planes.length > 0 && <SectionCaps planes={planes} />}
      <Markers planes={planes} layer={layer} />
      <ShadowUpdater planes={planes} />
      {/* Same setup as the real-estate engine's villa Explore view, which feels right. */}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} zoomToCursor />
      <CameraRig />
      {render.ao && (
        // multisampling 0: the composer's multisample resolve and N8AO both caused per-frame
        // WebGL errors (and 1–3 fps rotation) in the real-estate engine on this hardware.
        <EffectComposer multisampling={0} stencilBuffer>
          <N8AO aoRadius={r * 0.06} distanceFalloff={1} intensity={2.2} quality="medium" halfRes depthAwareUpsampling />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
    <div ref={layer} className="html-layer" />
    </>
  )
}
