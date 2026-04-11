import { resolve } from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/hadithmv/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      base: '/hadithmv/',
      injectRegister: 'auto',
      manifest: {
        name: 'hadithmv',
        short_name: 'hadithmv',
        description: 'hadithmv',
        theme_color: '#1a5c2e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/hadithmv/',
        scope: '/hadithmv/',
        lang: 'dv',
        dir: 'rtl',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,ttf}'],
        // Data files are large — runtime-cache them so they don't bloat the SW precache
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/hadithmv/data/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'hadithmv-data',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quran: resolve(__dirname, 'quran/index.html'),
      },
    },
  },
})
