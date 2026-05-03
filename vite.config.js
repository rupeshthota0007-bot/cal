import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // If VITE_LOCAL_BACKEND=true in .env.local, proxy to local server.
  // Otherwise, proxy to the live Vercel deployment — no backend needed locally!
  const apiTarget = env.VITE_LOCAL_BACKEND === 'true'
    ? 'http://localhost:4000'
    : 'https://xi-seven.vercel.app';

  return {
    plugins: [
      react(),
      command === 'serve' ? basicSsl() : null,
    ].filter(Boolean),
    server: {
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
})
