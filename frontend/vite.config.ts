import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/health': { target: 'http://127.0.0.1:8080' },
      '/meeting-types': { target: 'http://127.0.0.1:8080' },
      '/api': { target: 'http://127.0.0.1:8080', rewrite: (path) => path.replace(/^\/api/, '') },
      '/booking-window': { target: 'http://127.0.0.1:8080' },
      '/availability': { target: 'http://127.0.0.1:8080' },
    },
  },
  build: { outDir: '../dist/frontend', emptyOutDir: true },
});
