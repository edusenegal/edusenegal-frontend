import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Le proxy /api évite CORS en développement : le front appelle son propre
 * origin et Vite relaie vers la gateway. En production, le front et la
 * gateway sont servis derrière le même nom de domaine.
 *
 * Sur la branche `mock`, ce proxy ne sert à rien (aucun appel ne sort du
 * navigateur) mais reste en place pour que `npm run dev` se comporte à
 * l'identique une fois la branche `api` posée par-dessus, comme sur
 * student/web.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5174,
      proxy:
        mode === 'development'
          ? {
              '/api': {
                target: env.VITE_PROXY_TARGET || 'http://localhost:8000',
                changeOrigin: true,
              },
            }
          : undefined,
    },
    build: {
      target: 'es2022',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
      },
    },
  };
});
