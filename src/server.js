import { createServer } from 'node:http';
import { buildApp } from './app.js';

const app = await buildApp();
const server = createServer(app);
const close = () =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections();
  });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    const timeout = setTimeout(() => {
      console.error('Shutdown timed out');
      process.exit(1);
    }, 10_000);
    timeout.unref();
    try {
      await close();
      await app.locals.close();
      process.exitCode = 0;
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
    }
  });
server.once('error', async (error) => {
  console.error(error);
  await app.locals.close();
  process.exitCode = 1;
});
server.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () => {
  console.log(`St Stefanus Express API listening on port ${server.address().port}`);
});
