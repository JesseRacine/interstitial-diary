import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { normalizeBase } from './base-path.ts'
import { manifest } from './pwa-manifest.ts'

// "/" for dev and preview. The GitHub Pages deploy sets BASE_PATH=/interstitial-diary/ (see .github/workflows/deploy.yml).
const base = normalizeBase(process.env.BASE_PATH)

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new version waits until the user clicks Reload (see UpdatePrompt), so a half-written entry is never lost.
      registerType: 'prompt',
      injectRegister: false, // UpdatePrompt registers the worker through virtual:pwa-register
      manifest,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Precache the whole app shell, including the lazily loaded image worker chunk (assets/images.worker-*.js),
        // so the app opens and photos can be attached with no connection.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // In the native apps (not on the website) this makes a worker left by an older build clean itself up (see the file).
        importScripts: ['sw-native.js'],
        globIgnores: ['sw-native.js'], // loaded by the worker itself, not part of the saved copy
      },
    }),
  ],
})
