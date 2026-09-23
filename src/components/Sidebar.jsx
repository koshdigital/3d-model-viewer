import { useRef, useState } from 'react'
import {
  Box, Scissors, MapPin, Sun, Camera, Upload, FlipVertical2, Download, Plus, Check,
  PanelLeftClose, PanelLeftOpen, X, RotateCcw,
} from 'lucide-react'
import { useStore, isMobile } from '../store.js'
import { loadFromFolder, loadFromFile, setZUp, exportAnnotations, resetToPublished } from '../modelService.js'
import { PRESETS } from './Viewer.jsx'
import NoteEditor from './NoteEditor.jsx'

export const ACCEPT = '.glb,.gltf,.fbx,.obj,.3ds'

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  )
}

function ModelPanel() {
  const { models, modelIndex, modelName, object, zUp, error } = useStore()
  const file = useRef()
  return (
    <>
      {models.length > 0 && (
        <label className="field">
          <span>Models folder</span>
          <select value={modelIndex} onChange={(e) => loadFromFolder(+e.target.value)}>
            {modelIndex === -1 && <option value={-1}>{modelName || '—'} (dropped)</option>}
            {models.map((m, i) => (
              <option key={m.file} value={i}>
                {m.name}.{m.ext}
              </option>
            ))}
          </select>
        </label>
      )}
      <button className="btn" onClick={() => file.current.click()}>
        <Upload size={16} /> Open file…
      </button>
      <input ref={file} type="file" accept={ACCEPT} hidden onChange={(e) => loadFromFile(e.target.files[0])} />
      <p className="hint">Or drag and drop a GLB, GLTF, FBX, OBJ or 3DS file onto the viewer.</p>
      {object && <Toggle label="Model is Z-up" checked={zUp} onChange={setZUp} />}
      {error && <p className="error">{error}</p>}
    </>
  )
}

function SectionPanel() {
  const clip = useStore((s) => s.clip)
  const setClip = useStore((s) => s.setClip)
  const bounds = useStore((s) => s.bounds)
  return (
    <>
      {['x', 'y', 'z'].map((a) => {
        const c = clip[a]
        return (
          <div className="clip-row" key={a}>
            <label className="check">
              <input type="checkbox" checked={c.on} onChange={(e) => setClip(a, { on: e.target.checked })} />
              {a.toUpperCase()}
              {a === 'z' && <small>up</small>}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={c.t}
              disabled={!c.on || !bounds}
              onChange={(e) => setClip(a, { t: +e.target.value })}
            />
            <button
              className={`icon-btn${c.flip ? ' on' : ''}`}
              title="Flip cut direction"
              disabled={!c.on}
              onClick={() => setClip(a, { flip: !c.flip })}
            >
              <FlipVertical2 size={16} />
            </button>
          </div>
        )
      })}
      <button
        className="btn ghost"
        onClick={() => ['x', 'y', 'z'].forEach((a) => setClip(a, { on: false, t: 0.5, flip: false }))}
      >
        <RotateCcw size={16} /> Reset sections
      </button>
    </>
  )
}

function AnnotatePanel() {
  const { annotate, annotations, activeId, object, models, modelIndex, set, cam } = useStore()
  const published = models[modelIndex]?.notes
  return (
    <>
      <button className={`btn primary${annotate ? ' on' : ''}`} disabled={!object} onClick={() => set({ annotate: !annotate })}>
        {annotate ? <Check size={16} /> : <Plus size={16} />} {annotate ? 'Done placing' : 'Add annotations'}
      </button>
      <p className="hint">
        {annotate
          ? 'Click the model to drop a numbered point. Drag a number to move it.'
          : 'Click a number to read its note. Select one below to edit it.'}
      </p>
      {annotations.length > 0 && (
        <ol className="annot-list">
          {annotations.map((a, i) => (
            <li key={a.id}>
              <button
                className={a.id === activeId ? 'on' : ''}
                onClick={() => {
                  set({ activeId: a.id })
                  cam?.goTo(a.view)
                }}
              >
                <b>{i + 1}</b>
                <span>{a.note?.split('\n')[0] || 'No note yet'}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <NoteEditor />
      <div className="row">
        <button className="btn" disabled={!annotations.length} onClick={exportAnnotations}>
          <Download size={16} /> Export
        </button>
        <button
          className="btn ghost"
          disabled={!annotations.length}
          onClick={() => window.confirm('Delete all annotations?') && set({ annotations: [], activeId: null })}
        >
          Clear all
        </button>
      </div>
      {published && (
        <button className="btn ghost" onClick={resetToPublished}>
          <RotateCcw size={16} /> Reset to published
        </button>
      )}
      <p className="hint">
        Notes save in this browser. To publish them, put the exported file next to the model in <code>models/</code>.
      </p>
    </>
  )
}

function RenderPanel() {
  const render = useStore((s) => s.render)
  const setRender = useStore((s) => s.setRender)
  return (
    <>
      <div className="segmented">
        {['realistic', 'clay'].map((m) => (
          <button key={m} className={render.mode === m ? 'on' : ''} onClick={() => setRender({ mode: m })}>
            {m === 'realistic' ? 'Realistic' : 'Clay'}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Lighting preset</span>
        <select value={render.preset} onChange={(e) => setRender({ preset: e.target.value })}>
          {Object.entries(PRESETS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>
          Brightness <em>{render.brightness.toFixed(2)}</em>
        </span>
        <input
          type="range"
          min={0.3}
          max={2}
          step={0.01}
          value={render.brightness}
          onChange={(e) => setRender({ brightness: +e.target.value })}
        />
      </label>
      <Toggle label="Ambient occlusion" checked={render.ao} onChange={(v) => setRender({ ao: v })} />
      <Toggle label="Shadows" checked={render.shadows} onChange={(v) => setRender({ shadows: v })} />
    </>
  )
}

function CameraPanel() {
  const fov = useStore((s) => s.fov)
  const cam = useStore((s) => s.cam)
  const set = useStore((s) => s.set)
  return (
    <>
      <label className="field">
        <span>
          Field of view <em>{Math.round(fov)}°</em>
        </span>
        <input type="range" min={15} max={100} step={1} value={fov} onChange={(e) => set({ fov: +e.target.value })} />
      </label>
      <button className="btn" onClick={() => cam?.fit()}>
        <RotateCcw size={16} /> Reset view
      </button>
      <p className="hint">
        Drag to orbit. Right-drag or two fingers to pan. Scroll or pinch to zoom toward the cursor.
      </p>
    </>
  )
}

const SECTIONS = [
  { id: 'model', label: 'Model', Icon: Box, Panel: ModelPanel },
  { id: 'section', label: 'Section planes', Icon: Scissors, Panel: SectionPanel },
  { id: 'annotate', label: 'Annotations', Icon: MapPin, Panel: AnnotatePanel },
  { id: 'render', label: 'Render', Icon: Sun, Panel: RenderPanel },
  { id: 'camera', label: 'Camera', Icon: Camera, Panel: CameraPanel },
]

export default function Sidebar() {
  const [open, setOpen] = useState(isMobile ? null : 'model')
  const [last, setLast] = useState('model')
  const current = SECTIONS.find((s) => s.id === open)

  const pick = (id) => {
    setOpen(open === id ? null : id)
    setLast(id)
  }

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <nav className="rail">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button key={id} className={open === id ? 'on' : ''} title={label} aria-label={label} onClick={() => pick(id)}>
            <Icon size={20} />
          </button>
        ))}
        <button
          className="dock"
          title={open ? 'Dock panel' : 'Open panel'}
          aria-label={open ? 'Dock panel' : 'Open panel'}
          onClick={() => setOpen(open ? null : last)}
        >
          {open ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
      </nav>
      {current && (
        <section className="panel">
          <header>
            <h2>{current.label}</h2>
            <button className="icon-btn" aria-label="Close panel" onClick={() => setOpen(null)}>
              <X size={16} />
            </button>
          </header>
          <div className="panel-body">
            <current.Panel />
          </div>
        </section>
      )}
    </aside>
  )
}
