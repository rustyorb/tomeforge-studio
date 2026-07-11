import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // strictPort so the app always lives on 5199 — the start/stop scripts and the
  // preview config depend on the port never drifting to 5200 when 5199 is busy.
  // The /comfy and /a1111 proxies let the browser reach local image-gen
  // backends same-origin — no CORS flags needed on those servers at all.
  server: {
    port: 5199,
    strictPort: true,
    proxy: {
      '/comfy': {
        target: 'http://192.168.0.69:8188',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/comfy/, ''),
      },
      '/a1111': {
        target: 'http://127.0.0.1:7860',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/a1111/, ''),
      },
    },
  },
})
