/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiDevServer } from './server/vite-api-plugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only settings for the dev API. Vite exposes only VITE_* variables
  // to browser code, so none of these reach the bundle.
  const serverEnv = loadEnv(mode, process.cwd(), ['KV_', 'UPSTASH_', 'LEADERBOARD_'])

  return {
    plugins: [react(), apiDevServer(serverEnv)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // UI tests type into inputs keystroke by keystroke; they take 1–3s alone
      // but can pass the 5s default when every test file runs in parallel.
      testTimeout: 15_000,
    },
  }
})
