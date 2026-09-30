import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Serves api/summarize.js during `npm run dev`, mirroring Vercel's /api routes
const apiDevServer = () => ({
  name: 'api-dev-server',
  configureServer(server) {
    server.middlewares.use('/api/summarize', async (req, res) => {
      // Connect strips the mount path; restore it so the handler sees the full URL
      req.url = '/api/summarize' + req.url
      const { default: handler } = await server.ssrLoadModule('/api/summarize.js')
      handler(req, res)
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Expose server-only vars from .env (e.g. GEMINI_API_KEY) to the dev API
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), apiDevServer()],
  }
})
