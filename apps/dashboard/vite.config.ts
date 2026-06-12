import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/v1': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
      '/readyz': 'http://localhost:3000',
    },
  },
})
