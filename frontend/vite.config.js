import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => {
  // Use different base URL for development vs production
  const base = command === 'build' 
    ? '/Smart-Attendance-and-Attentiveness-Monitoring-System/' 
    : '/'

  return {
    plugins: [react(), tailwindcss()],
    base,
    build: {
      outDir: 'dist',
      assetsDir: 'assets'
    }
  }
})
