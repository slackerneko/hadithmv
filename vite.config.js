import { resolve } from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { quranPagesPlugin } from './vite-plugin-quran-pages.js'

// Derive GitHub Pages origin from the env var GitHub Actions sets automatically.
// e.g. GITHUB_REPOSITORY="slackerneko/hadithmv" → "https://slackerneko.github.io"
// Falls back to '' locally — the plugin omits og:url/canonical when empty.
const SITE_URL = process.env.GITHUB_REPOSITORY
  ? `https://${process.env.GITHUB_REPOSITORY.split('/')[0]}.github.io`
  : ''

// Dev only: rewrite /quran/N and /quran/juz/N to serve quran/index.html
// (browser address bar keeps the real URL; JS reads window.location.pathname)
// In production, these are real pre-generated static files from quranPagesPlugin.
const quranHistoryFallback = {
  name: 'quran-history-fallback',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (/\/quran\/(juz\/\d+|\d+)/.test(req.url)) {
        req.url = req.url.replace(/\/quran\/(juz\/\d+|\d+)[^?]*/, '/quran/index.html')
      }
      next()
    })
  },
}

export default defineConfig({
  base: '/hadithmv/',
  plugins: [
    quranHistoryFallback,
    quranPagesPlugin({ siteUrl: SITE_URL }),
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
