import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Test-only config: same app, different ports, API proxied to test backend on 5001.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
});
