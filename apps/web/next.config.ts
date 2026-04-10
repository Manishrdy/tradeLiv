import type { NextConfig } from 'next';
import path from 'path';
import { config as loadEnv } from 'dotenv';

// Load monorepo root .env so NEXT_PUBLIC_* vars are available at build time
loadEnv({ path: path.resolve(__dirname, '../../.env'), override: false });

const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
const isProduction = nodeEnv === 'production';

const resolvedApiUrl = process.env.NEXT_PUBLIC_API_URL || (isProduction
  ? (process.env.PROD_NEXT_PUBLIC_API_URL || process.env.PROD_FRONTEND_URL || 'http://localhost:4000')
  : (process.env.DEV_NEXT_PUBLIC_API_URL || 'http://localhost:4000'));

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: resolvedApiUrl,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  },
};

export default nextConfig;
