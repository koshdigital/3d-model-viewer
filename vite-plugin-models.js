import fs from 'node:fs'
import path from 'node:path'
import { K } from './src/key.js'

const SUPPORTED = ['glb', 'gltf', 'fbx', 'obj', '3ds']
const keyBytes = Buffer.from(K)

const extOf = (f) => path.extname(f).slice(1).toLowerCase()

function encode(buf) {
  const out = Buffer.from(buf)
  for (let i = 0; i < out.length; i++) out[i] ^= keyBytes[i % keyBytes.length]
  return out
}

// Scans the models folder and serves/emits an obfuscated copy of each model
// under neutral names, plus a manifest the app reads at startup.
export default function modelsPlugin({ dir = 'models' } = {}) {
  const root = path.resolve(dir)

  function scan() {
    if (!fs.existsSync(root)) return []
    const files = fs.readdirSync(root).sort()
    for (const f of files) {
      if (extOf(f) === 'skp') console.warn(`[models] ${f}: SketchUp files can't be read in a browser. Export to GLB/FBX/OBJ.`)
    }
    return files
      .filter((f) => SUPPORTED.includes(extOf(f)))
      .map((f, i) => {
        const base = f.slice(0, -(extOf(f).length + 1))
        const notes = path.join(root, `${base}.annotations.json`)
        return {
          src: path.join(root, f),
          notesSrc: fs.existsSync(notes) ? notes : null,
          entry: { name: base, ext: extOf(f), file: `m${i}.bin`, notes: fs.existsSync(notes) ? `m${i}.json` : null },
        }
      })
  }

  return {
    name: 'models-folder',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0])
        if (!url.startsWith('/models/')) return next()
        const name = url.slice('/models/'.length)
        const items = scan()
        if (name === 'manifest.json') {
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify(items.map((m) => m.entry)))
        }
        const hit = items.find((m) => m.entry.file === name || m.entry.notes === name)
        if (!hit) return next()
        if (hit.entry.file === name) {
          res.setHeader('Content-Type', 'application/octet-stream')
          return res.end(encode(fs.readFileSync(hit.src)))
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(fs.readFileSync(hit.notesSrc))
      })
    },
    generateBundle() {
      const items = scan()
      this.emitFile({ type: 'asset', fileName: 'models/manifest.json', source: JSON.stringify(items.map((m) => m.entry)) })
      for (const m of items) {
        this.emitFile({ type: 'asset', fileName: `models/${m.entry.file}`, source: encode(fs.readFileSync(m.src)) })
        if (m.notesSrc) this.emitFile({ type: 'asset', fileName: `models/${m.entry.notes}`, source: fs.readFileSync(m.notesSrc) })
      }
    },
  }
}
