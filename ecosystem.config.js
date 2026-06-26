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
      // Graceful restart before the kernel OOM killer fires. PM2 restart is
      // ~10s; an OOM kill + cold start is 60–120s and surfaces as gateway
      // timeouts to users.
      max_memory_restart: '220M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        // Cap heap so the OOM killer doesn't fire on the 1 GB OCI VM.
        // API settles at ~80 MB at runtime; 256 MB leaves room for the web app.
        NODE_OPTIONS: '--max-old-space-size=192',
        // Run backups on cron/manual triggers, not immediately at API boot.
        RUN_BACKUP_ON_STARTUP: 'false',
      },
    },
    {
      // Static SPA server for the Vite build output (apps/web/dist). Replaces the
      // Next.js `next start` process — serves prerendered pages + SPA fallback at
      // ~40 MB RSS instead of ~450 MB, the main RAM win on the 1 GB VM.
      name: 'tradeliv-web',
      script: 'serve.mjs',
      cwd: '/home/ubuntu/tradeLiv/apps/web',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '120M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        NODE_OPTIONS: '--max-old-space-size=96',
      },
    },
  ],
};


