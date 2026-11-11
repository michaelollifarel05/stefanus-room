import jwt from 'jsonwebtoken';
import { createPool } from './db.js';
import { createHttpApp } from './http.js';
import { createAuthGuards } from './middleware/auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes } from './routes/auth.js';

// Assemble the application here; endpoint behavior lives in controllers/.
export async function buildApp(options = {}) {
  const secret = options.jwtSecret ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-with')) {
    throw new Error('JWT_SECRET must be a random secret of at least 32 characters');
  }

  const pool = options.pool ?? createPool();
  const { app, route, finish } = createHttpApp();
  const guards = createAuthGuards(pool, secret);
  const signToken = (userId) =>
    jwt.sign({ sub: userId }, secret, {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: 'st-stefanus-api',
      audience: 'st-stefanus',
    });

  app.locals.db = pool;
  app.locals.close = async () => {
    // Tests supply their own pool and close it themselves.
    if (!options.pool) await pool.end();
  };

  const dependencies = { route, pool, guards, signToken };
  registerHealthRoutes(dependencies);
  registerAuthRoutes(dependencies);

  // Mount Swagger and the error handler after all API routes.
  finish(options.logger ?? true);
  return app;
}
