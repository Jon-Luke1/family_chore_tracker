import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/family_chore_tracker/',
  build: {
    outDir: 'dist',
  },
})
