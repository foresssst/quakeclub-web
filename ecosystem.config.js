module.exports = {
  apps: [
    {
      name: 'quakeclub-prod',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        TZ: 'America/Santiago'
      }
    }
  ]
};

