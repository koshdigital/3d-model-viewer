import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'
import models from './vite-plugin-models.js'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    models({ dir: 'models' }),
    obfuscator({
      apply: 'build',
      include: [/[\/]src[\/].*\.jsx?$/],
      exclude: [/node_modules/],
      options: {
        compact: true,
        identifierNamesGenerator: 'hexadecimal',
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 1,
        splitStrings: true,
        splitStringsChunkLength: 6,
        selfDefending: true,
      },
    }),
  ],
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: { compress: { drop_console: true }, format: { comments: false } },
    chunkSizeWarningLimit: 3000,
  },
})
