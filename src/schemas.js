// Input validation and Swagger response models for the login presentation.
export const object = (properties, required = Object.keys(properties)) => ({
  type: 'object', additionalProperties: false, properties, required,
});

const user = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['ADMIN', 'SECRETARIAT', 'MEMBER'] },
    organization_id: { type: 'string', format: 'uuid', nullable: true },
    active: { type: 'boolean' },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export function responseSchema(method, path) {
  if (path === '/health') return { type: 'object', properties: { status: { type: 'string' } } };
  if (path === '/auth/login') return {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      tokenType: { type: 'string', example: 'Bearer' },
      expiresIn: { type: 'integer', example: 3600 },
    },
  };
  if (path === '/auth/me') return user;
  throw new Error(`Missing response schema: ${method} ${path}`);
}
