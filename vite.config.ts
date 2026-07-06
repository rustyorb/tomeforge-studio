import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // strictPort so the app always lives on 5199 — the start/stop scripts and the
  // preview config depend on the port never drifting to 5200 when 5199 is busy.
  server: { port: 5199, strictPort: true },
})
