import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app.js';

const app = createApp();
if (process.argv.includes('--production')) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, watch: { usePolling: true, interval: 500 } }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 5173);
app.listen(port, '127.0.0.1', () => console.log(`Vogue Vision is ready at http://localhost:${port}`));
