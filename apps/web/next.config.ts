import type { NextConfig } from 'next';
import os from 'os';

const isOCI = os.hostname().toLowerCase().includes('ubuntu');

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: isOCI
      ? (process.env.PROD_NEXT_PUBLIC_API_URL || `http://${process.env.OCI_IP}:4000`)
      : (process.env.DEV_NEXT_PUBLIC_API_URL || 'http://localhost:4000'),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  },
};

export default nextConfig;
