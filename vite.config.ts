import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://transit.yahoo.co.jp',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            if (proxyRes.headers['location']) {
              let location = proxyRes.headers['location'];
              if (location && location.startsWith('/')) {
                proxyRes.headers['location'] = '/api/yahoo' + location;
              }
            }
          });
        },
      },
    },
  },})
