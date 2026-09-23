import { useEffect, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Sidebar, { ACCEPT } from './components/Sidebar.jsx'
import Viewer from './components/Viewer.jsx'
import { useStore } from './store.js'
import { loadManifest, loadFromFile, saveAnnotations } from './modelService.js'

function DropZone() {
  const error = useStore((s) => s.error)
  const file = useRef()
  return (
    <div className="dropzone">
      <Upload size={32} />
      <h2>Drop a 3D model here</h2>
      <p>GLB · GLTF · FBX · OBJ · 3DS</p>
      <button className="btn primary" onClick={() => file.current.click()}>
        Browse files
      </button>
      <input ref={file} type="file" accept={ACCEPT} hidden onChange={(e) => loadFromFile(e.target.files[0])} />
      {error && <p className="error">{error}</p>}
    </div>
  )
}

export default function App() {
  const object = useStore((s) => s.object)
  const loading = useStore((s) => s.loading)
  const annotate = useStore((s) => s.annotate)
  const [drag, setDrag] = useState(false)

  useEffect(() => {
    loadManifest()
    // Persist edits, but not the initial load of a model's annotations.
    return useStore.subscribe((s, p) => {
      if (s.annotations !== p.annotations && s.object === p.object) saveAnnotations()
    })
  }, [])

  return (
    <div className="app">
      <Sidebar />
      <main
        className={`viewport${annotate ? ' annotating' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          loadFromFile(e.dataTransfer.files[0])
        }}
      >
        <Viewer />
        {!object && !loading && <DropZone />}
        {drag && <div className="drop-overlay">Drop to load model</div>}
        {loading && (
          <div className="loading">
            <div className="spinner" /> Loading model…
          </div>
        )}
        {annotate && <div className="pill">Click the model to place a point</div>}
      </main>
    </div>
  )
}
