import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const SERVER_ENV = [
  'AI_API_KEY',
  'AI_BASE_URL',
  'AI_MODEL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  for (const key of SERVER_ENV) {
    if (fileEnv[key]) process.env[key] = fileEnv[key]
  }

  const adapter = fileURLToPath(new URL('./src/server/node-adapter.ts', import.meta.url))

  return {
    base: process.env.BASE_PATH || '/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'spa-fallback',
        closeBundle() {
          copyFileSync('dist/index.html', 'dist/404.html')
        },
      },
      {
        name: 'tutor-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const path = req.url?.split('?')[0] ?? ''
            if (path !== '/api/generate-deck') {
              next()
              return
            }
            void server
              .ssrLoadModule(adapter)
              .then(async (mod) => {
                const handle = mod.handleNode as ((request: typeof req, response: typeof res) => Promise<void>) | undefined
                if (!handle) throw new Error('missing tutor handler')
                await handle(req, res)
              })
              .catch((error: unknown) => {
                console.error('[tutor] dev api failed', error)
                if (!res.headersSent) {
                  res.statusCode = 500
                  res.setHeader('content-type', 'application/json; charset=utf-8')
                  res.end(JSON.stringify({ error: 'upstream' }))
                }
              })
          })
        },
      },
    ],
  }
})
