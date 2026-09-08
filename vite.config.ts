import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a worker that swaps itself in on its own
      // can replace the running app mid-shift on a signal flicker
      // underground. UpdatePrompt.tsx surfaces the "update available"
      // control that reloads only when tapped. See DECISIONS.md.
      registerType: 'prompt',
      // We register the service worker ourselves via the
      // virtual:pwa-register/react hook (UpdatePrompt.tsx), so the plugin
      // should not also inject its own registration script.
      injectRegister: false,
      strategies: 'generateSW',
      workbox: {
        // The plan image is the one asset that must survive a cold start
        // with no network — an underground user opening the app to a blank
        // map is the failure Phase 4 exists to prevent. It's matched here
        // by extension along with the rest of the built app shell; Leaflet's
        // CSS is imported into MapScreen.tsx and bundled into the built
        // .css file, so it's already covered by the {css} pattern below.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      includeAssets: [
        'plans/level-24.png',
        'plans/level-24.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-512-maskable.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'Air Leak Survey',
        short_name: 'Leak Survey',
        description: 'Log and cost compressed air leaks on an underground level plan, offline.',
        display: 'standalone',
        // Matches the app's existing dark background (see src/index.css /
        // inline styles throughout), not the Vite/plugin defaults.
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
