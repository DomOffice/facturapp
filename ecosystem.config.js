module.exports = {
  apps: [
    {
      name: 'facturapp',
      script: 'node',
      args: 'node_modules/next/dist/bin/next start -H 0.0.0.0',
      cwd: 'C:\\serveur\\facturapp',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:6343@localhost:5432/facturapp_db',
        NEXTAUTH_SECRET: 'facturapp_2026_cle_super_secrete_berrada_erp_system',
        NEXTAUTH_URL: 'http://10.8.0.1:3000',

        MYSQL_HOST: '127.0.0.1',
        MYSQL_PORT: '3306',
        MYSQL_DATABASE: 'erp2026',
        MYSQL_USER: 'root',
        MYSQL_PASSWORD: '516642'
      },
    },
  ],
}