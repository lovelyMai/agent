import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': '/src'
    },
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      fileName: () => `utils.js`,
      formats: ['es']
    },
  },
})