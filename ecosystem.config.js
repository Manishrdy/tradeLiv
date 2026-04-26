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
        // API settles at ~80 MB at runtime; 384 MB gives ample startup headroom.
        NODE_OPTIONS: '--max-old-space-size=384',
      },
    },
    {
      name: 'tradeliv-web',
      script: 'npm',
      args: 'run start --workspace=apps/web',
      cwd: '/home/ubuntu/tradeLiv',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        // Next.js startup is heavier; 512 MB cap keeps it within bounds
        // while still leaving room for the API on the same 1 GB VM.
        NODE_OPTIONS: '--max-old-space-size=512',
      },
    },
  ],
};
