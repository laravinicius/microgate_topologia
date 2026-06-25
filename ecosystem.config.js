const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  apps: [{
    name: "topologia-server",
    script: "server.js",
    cwd: "/var/www/topologia",
    env: {
      NODE_ENV: "production",
      PORT: 3005,
      JWT_SECRET: process.env.JWT_SECRET,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD
    },
    instances: 1,
    max_memory_restart: "200M",
    watch: true,
    watch_options: {
      followSymlinks: false,
      ignored: ['node_modules', 'frontend/node_modules', 'frontend/dist', '.env', '.sessions.json']
    },
    restart_delay: 5000,
    merge_logs: true
  }]
};
