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
        bodyCentricHands: resolve(__dirname, 'MediaPipeBodyCentricHands.html'),
        mpThreeModelViewer: resolve(__dirname, 'SpinTheShark.html'),
        mpWorld: resolve(__dirname, 'WorldInYourHands.html'),
        mpStarfield: resolve(__dirname, 'WarpFingers.html')
      },
    },
  },
})