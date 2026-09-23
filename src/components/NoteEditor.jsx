import { useState } from 'react'
import { X, Eye, Save, Trash2 } from 'lucide-react'
import { useStore } from '../store.js'

// Editor for the selected annotation, shown in the Annotations side panel.
export default function NoteEditor() {
  const { annotations, activeId, fov, cam, set, updateAnnotation } = useStore()
  const [saved, setSaved] = useState(false)
  const i = annotations.findIndex((a) => a.id === activeId)
  if (i < 0) return null
  const a = annotations[i]

  return (
    <div className="note-editor">
      <header>
        <span className="marker active">{i + 1}</span>
        <h3>Edit note</h3>
        <button className="icon-btn" aria-label="Close note" onClick={() => set({ activeId: null })}>
          <X size={16} />
        </button>
      </header>
      <textarea
        value={a.note}
        placeholder="Write a note…"
        rows={4}
        onChange={(e) => updateAnnotation(a.id, { note: e.target.value })}
      />
      <label className="field">
        <span>
          Field of view <em>{Math.round(fov)}°</em>
        </span>
        <input type="range" min={15} max={100} step={1} value={fov} onChange={(e) => set({ fov: +e.target.value })} />
      </label>
      <div className="row">
        <button className="btn" onClick={() => cam?.goTo(a.view)}>
          <Eye size={16} /> Go to view
        </button>
        <button
          className="btn"
          onClick={() => {
            updateAnnotation(a.id, { view: cam.getView() })
            setSaved(true)
            setTimeout(() => setSaved(false), 1200)
          }}
        >
          <Save size={16} /> {saved ? 'Saved' : 'Save view'}
        </button>
      </div>
      <button
        className="btn ghost danger"
        onClick={() => set({ annotations: annotations.filter((x) => x.id !== a.id), activeId: null })}
      >
        <Trash2 size={16} /> Delete annotation
      </button>
    </div>
  )
}
