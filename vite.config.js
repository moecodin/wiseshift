import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE is the folder the site is served from. It stays '/' normally and is
// set to '/wiseshift/' by the GitHub Pages workflow.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})
