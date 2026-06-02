module.exports = {
  apps: [
    {
      name: 'facturapp',
      script: 'node',
      args: 'node_modules/next/dist/bin/next start -H 0.0.0.0',
      cwd: 'C:\\serveur\\facturapp',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}