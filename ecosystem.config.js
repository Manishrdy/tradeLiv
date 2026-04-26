module.exports = {
  apps: [
    {
      name: 'tradeliv-api',
      script: 'node',
      args: 'dist/index.js',
      cwd: '/home/ubuntu/tradeLiv/apps/api',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        // Cap heap so the OOM killer doesn't fire on the 1 GB OCI VM.
        // API settles at ~80 MB at runtime; 256 MB leaves room for the web app.
        NODE_OPTIONS: '--max-old-space-size=256',
      },
    },
    {
      name: 'tradeliv-web',
      script: '/home/ubuntu/tradeLiv/node_modules/next/dist/bin/next',
      args: 'start --port 3000',
      cwd: '/home/ubuntu/tradeLiv/apps/web',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        // Next.js startup is heavier; keep enough room for the OS, PM2, and API.
        NODE_OPTIONS: '--max-old-space-size=384',
      },
    },
  ],
};
