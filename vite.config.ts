import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Usa a porta do ambiente (preview) quando existir; senão 5173 (dev normal do Anderson)
    port: Number(process.env.PORT) || 5173,
  },
})
