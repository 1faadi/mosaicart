import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: { port: Number(process.env.PORT) || 5173 },
  plugins: [react()],
})
