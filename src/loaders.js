import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { K } from './key.js'

export const SUPPORTED = ['glb', 'gltf', 'fbx', 'obj', '3ds']

export function decode(buffer) {
  const k = new TextEncoder().encode(K)
  const u = new Uint8Array(buffer)
  for (let i = 0; i < u.length; i++) u[i] ^= k[i % k.length]
  return u.buffer
}

let gltfLoader
function gltf() {
  if (!gltfLoader) {
    const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    gltfLoader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder)
  }
  return gltfLoader
}

export async function parseModel(buffer, ext) {
  switch (ext) {
    case 'glb':
    case 'gltf':
      return new Promise((res, rej) => gltf().parse(buffer, '', (g) => res(g.scene), rej))
    case 'fbx':
      return new FBXLoader().parse(buffer, '')
    case 'obj':
      return new OBJLoader().parse(new TextDecoder().decode(buffer))
    case '3ds':
      return new TDSLoader().parse(buffer, '')
    case 'skp':
      throw new Error("SketchUp (.skp) files can't be read in a browser. Export the model as GLB, FBX or OBJ from SketchUp.")
    default:
      throw new Error(`Unsupported format ".${ext}". Use ${SUPPORTED.join(', ')}.`)
  }
}
