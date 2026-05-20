import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const foxingApi = env.FOXING_API_URL ?? 'https://foxing.app'

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: foxingApi,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      sourcemap: true,
    },
    define: {
      __FOXING_API__: JSON.stringify(foxingApi),
    },
  }
})
