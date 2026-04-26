module.exports = {
  apps: [
    {
      name: 'tradeliv-api',
      script: 'node',
      args: 'dist/index.js',
      cwd: '/home/ubuntu/tradeLiv/apps/api',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        // Cap heap so the OOM killer doesn't fire on the 1 GB OCI VM.
        // API settles at ~80 MB at runtime; 256 MB leaves room for the web app.
        NODE_OPTIONS: '--max-old-space-size=192 --optimize-for-size',
        // Run backups on cron/manual triggers, not immediately at API boot.
        RUN_BACKUP_ON_STARTUP: 'false',
      },
    },
    {
      name: 'tradeliv-web',
      script: '/home/ubuntu/tradeLiv/node_modules/next/dist/bin/next',
      args: 'start --port 3000',
      cwd: '/home/ubuntu/tradeLiv/apps/web',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
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
