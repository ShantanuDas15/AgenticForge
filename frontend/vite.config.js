import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  plugins: [react()],

  // Path aliases — allows `import X from '@/components/...'`
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@xyflow')) return 'flow';
            if (id.includes('lucide-react') || id.includes('framer-motion') || id.includes('react-markdown') || id.includes('remark-gfm')) return 'ui';
            if (id.includes('react') || id.includes('zustand') || id.includes('axios')) return 'vendor';
          }
        }
      }
    }
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
