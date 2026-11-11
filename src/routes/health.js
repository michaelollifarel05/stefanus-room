import { createHealthController } from '../controllers/health.js';

export function registerHealthRoutes({ route, pool }) {
  const controller = createHealthController({ pool });

  route({
    method: 'GET',
    path: '/health',
    tag: 'Health',
    summary: 'Check API and database readiness',
    guard: null,
    schema: {},
    handler: controller.checkHealth,
  });
}
