import type { ManifestOptions } from 'vite-plugin-pwa'

// The web app manifest. Lives in its own file so a test can check that every icon it names exists.
// Paths are relative (no leading slash), so the app works from a sub-path such as GitHub Pages.
export const manifest: Partial<ManifestOptions> = {
  name: 'Interstitial Diary',
  short_name: 'Interstitial',
  description: 'A quick, searchable interstitial journal.',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#f7f5f1', // --bg in index.css (light)
  theme_color: '#3d6b5e', // --accent in index.css (light)
  categories: ['productivity', 'lifestyle'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  // Long-press the installed icon: jump straight to the journal with the capture box focused (it autofocuses).
  shortcuts: [
    {
      name: 'New entry',
      short_name: 'New entry',
      description: 'Open the journal and start typing',
      url: './?view=journal',
      icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    },
  ],
}
