import { config } from './config';
import { createApp } from './app';
import { initializeDatabase, pool } from './db';

async function main() {
  await initializeDatabase();
  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`Campus open day server listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down.`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
