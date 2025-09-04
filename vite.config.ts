import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'webroot',
    emptyOutDir: false,
    rollupOptions: {
      input: './webroot/game.ts',
      output: {
        entryFileNames: 'game.bundle.js',
        format: 'es'
      }
    }
  }
});


