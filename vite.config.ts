import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bodyCentricHands: resolve(__dirname, 'examples/MediaPipeDebug.html'),
        mpThreeModelViewer: resolve(__dirname, 'examples/SpinTheShark.html'),
        mpWorld: resolve(__dirname, 'examples/WorldInYourHands.html'),
        mpStarfield: resolve(__dirname, 'examples/WarpFingers.html')
      },
    },
  },
})