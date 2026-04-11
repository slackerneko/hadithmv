import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/hadithmv/',
  plugins: [
    {
      name: 'trailing-slash-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && !req.url.includes('.') && !req.url.endsWith('/') && !req.url.startsWith('/@')) {
            res.writeHead(301, { Location: req.url + '/' })
            res.end()
            return
          }
          next()
        })
      },
    },
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
