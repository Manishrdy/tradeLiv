import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Load env from the monorepo root (.env), accepting both the new VITE_* names and
  // the legacy NEXT_PUBLIC_* names so the existing PROD_ENV secret keeps working.
  const repoRoot = path.resolve(__dirname, '../..');
  const env = loadEnv(mode, repoRoot, ['VITE_', 'NEXT_PUBLIC_', 'PROD_', 'DEV_']);
  const pick = (...keys: string[]) =>
    keys.map((k) => process.env[k] ?? env[k]).find((v) => v) ?? '';

  const isProd = mode === 'production';
  const apiUrl =
    pick('VITE_API_URL', 'NEXT_PUBLIC_API_URL') ||
    (isProd ? pick('PROD_NEXT_PUBLIC_API_URL') : pick('DEV_NEXT_PUBLIC_API_URL')) ||
    'http://localhost:4000';
  const mapsKey = pick('VITE_GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  const stripeKey = pick('VITE_STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_PUBLISHABLE_KEY');

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
      dedupe: ['react', 'react-dom'],
    },
    // Bundle the router/zustand during SSR/prerender so their `react` import resolves
    // through dedupe (React 19) instead of the monorepo root's react@18.
    ssr: {
      noExternal: ['react-router-dom', 'react-router', 'zustand'],
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsKey),
      'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(stripeKey),
    },
    server: { port: 3000 },
    build: { chunkSizeWarningLimit: 1200 },
  };
});
