/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiDevServer } from './server/vite-api-plugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load SPOTIFY_* from .env for the dev API only. Vite exposes just VITE_*
  // variables to browser code, so the secret never ends up in the bundle.
  const serverEnv = loadEnv(mode, process.cwd(), 'SPOTIFY_')

  return {
    plugins: [react(), apiDevServer(serverEnv)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
