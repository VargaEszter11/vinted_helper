import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';

import { config } from './config.js';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import bundleRoutes from './routes/bundles.js';
import itemRoutes from './routes/items.js';
import photoRoutes from './routes/photos.js';

export async function buildApp() {
  // Photos are uploaded as base64 JSON, hence the large body limit.
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024, trustProxy: true });

  await app.register(cors, {
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: '30d' } });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: 'Please sign in again.' });
    }
  });

  app.get('/health', async () => {
    await pool.query('select 1');
    return { ok: true };
  });

  await app.register(authRoutes);
  await app.register(itemRoutes);
  await app.register(bundleRoutes);
  await app.register(photoRoutes);

  return app;
}
