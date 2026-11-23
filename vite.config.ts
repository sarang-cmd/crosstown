// Development server accepts the isolated Arena preview host; all app URLs remain relative.
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
    watch: { ignored: ['**/.arena/**', '**/docs/**', '**/assets/sources/**'] },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'] },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2400,
    rollupOptions: { output: { manualChunks: { physics: ['@dimforge/rapier3d-compat'], rendering: ['three/webgpu', 'three/tsl'] } } },
  },
});
