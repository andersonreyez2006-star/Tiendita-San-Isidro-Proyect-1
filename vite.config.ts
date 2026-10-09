import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  preview: {
    host: true,
    port: 5180,
    strictPort: true,
    allowedHosts: true
  }
});
