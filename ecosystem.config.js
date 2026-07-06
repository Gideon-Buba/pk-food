module.exports = {
  apps: [
    {
      name: 'pk-food-server',
      cwd: './server',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        SERVER_PORT: 3000,
      },
    },
  ],
};
