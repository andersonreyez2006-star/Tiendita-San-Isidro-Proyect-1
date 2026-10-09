import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // The browser calls /api on the same origin, including through a Cloudflare tunnel.
            // Drop Origin so Express does not reject the tunnel's temporary hostname via CORS.
            proxyReq.removeHeader('origin');
          });
        }
      }
    }
  },
  preview: {
    host: true,
    port: 5180,
    strictPort: true,
    allowedHosts: true
  }
});
