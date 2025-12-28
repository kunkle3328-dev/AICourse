import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Manually define process.env.API_KEY to ensure it works in browser code
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
    },
    server: {
      // Proxy API requests to Vercel dev server default port if running in vite dev mode
      // Ideally, users run 'vercel dev', but this helps if they run 'npm run dev' and have a backend running elsewhere
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    }
  };
});