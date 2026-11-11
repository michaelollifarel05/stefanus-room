import { createAuthController } from '../controllers/auth.js';
import { object } from '../schemas.js';

export function registerAuthRoutes({ route, pool, guards, signToken }) {
  const controller = createAuthController({ pool, signToken });
  const { requireAuth } = guards;

  route({
    method: 'POST',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Login with email and password (token expires in one hour)',
    guard: null,
    schema: {
      body: object({
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: 1, maxLength: 128 },
      }),
    },
    handler: controller.login,
  });

  route({
    method: 'GET',
    path: '/auth/me',
    tag: 'Auth',
    summary: 'Get current user',
    guard: requireAuth,
    schema: {},
    handler: controller.getCurrentUser,
  });
}
