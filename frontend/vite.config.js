import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // In dev, forward API calls to the FastAPI server
  server: { proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT || 8000}` } },
})
