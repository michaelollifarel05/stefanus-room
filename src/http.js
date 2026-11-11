import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { fail } from './domain.js';
import { responseSchema } from './schemas.js';

// The same input schemas drive request validation and OpenAPI documentation.
export function createHttpApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') }));
  const limitHandler = (_req, res) =>
    res.status(429).json({ error: 'Too many requests, please try again later', statusCode: 429 });
  app.use(rateLimit({ windowMs: 60_000, limit: 200, handler: limitHandler }));
  app.use('/auth/login', rateLimit({ windowMs: 60_000, limit: 10, handler: limitHandler }));
  app.use(express.json({ limit: '64kb' }));

  const ajv = addFormats(new Ajv({ coerceTypes: true, useDefaults: true, allErrors: true }));
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'St Stefanus Login API',
      version: '1.0.0',
      description:
        'Presentasi tahap login. POST /auth/login menghasilkan JWT yang berlaku satu jam. Salin accessToken ke Authorize, lalu coba GET /auth/me. Database lengkap dipertahankan untuk presentasi desain; endpoint fitur lainnya belum ditampilkan.',
    },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    tags: ['Health', 'Auth'].map((name) => ({ name })),
    paths: {},
  };
  const errorSchema = {
    type: 'object',
    properties: { error: { type: 'string' }, statusCode: { type: 'integer' } },
  };

  // Register an Express endpoint and document it from the same configuration.
  // Controllers may return data (sent as JSON) or use res.status(...).send(...).
  function route({ method, path: url, tag, summary, guard, schema = {}, handler }) {
    const validators = Object.fromEntries(
      Object.entries(schema).map(([key, value]) => [key, ajv.compile(value)]),
    );
    const parameters = [];
    for (const [key, location] of [
      ['params', 'path'],
      ['querystring', 'query'],
    ]) {
      for (const [name, value] of Object.entries(schema[key]?.properties ?? {})) {
        parameters.push({
          name,
          in: location,
          required: location === 'path' || schema[key].required.includes(name),
          schema: value,
        });
      }
    }
    const successCode = 200;
    const path = url.replace(/:([a-zA-Z]+)/g, '{$1}');
    spec.paths[path] ??= {};
    spec.paths[path][method.toLowerCase()] = {
      tags: [tag],
      summary,
      ...(guard && { security: [{ bearerAuth: [] }] }),
      ...(parameters.length && { parameters }),
      ...(schema.body && {
        requestBody: { required: true, content: { 'application/json': { schema: schema.body } } },
      }),
      responses: {
        [successCode]: {
          description: 'Success',
          content: { 'application/json': { schema: responseSchema(method, url) } },
        },
        ...Object.fromEntries(
          [
            [400, 'Validation failed'],
            [401, 'Authentication required'],
            [403, 'Permission denied'],
            [404, 'Record not found'],
            [409, 'Conflict or invalid state transition'],
            [413, 'Request too large'],
            [429, 'Rate limit exceeded'],
            [500, 'Internal server error'],
          ].map(([code, description]) => [
            code,
            { description, content: { 'application/json': { schema: errorSchema } } },
          ]),
        ),
      },
    };
    app[method.toLowerCase()](url, async (req, res) => {
      req.validatedQuery = { ...req.query };
      for (const [key, validate] of Object.entries(validators)) {
        const value = key === 'querystring' ? req.validatedQuery : req[key];
        if (!validate(value)) fail(400, `${key}: ${ajv.errorsText(validate.errors)}`);
      }
      if (guard) await guard(req);
      const result = await handler(req, res);
      if (!res.headersSent) res.json(result);
    });
  }
  function finish(logger) {
    app.get('/docs/json', (_req, res) => res.json(spec));
    app.get('/docs/yaml', (_req, res) =>
      res.type('application/yaml').send(YAML.stringify(spec, { aliasDuplicateObjects: false })),
    );
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
    app.use((_req, _res, next) =>
      next(Object.assign(new Error('Route not found'), { statusCode: 404 })),
    );
    app.use((error, _req, res, next) => {
      if (res.headersSent) return next(error);
      let status = error.statusCode ?? error.status ?? 500;
      let message = error.message;
      if (error.code === '23505') {
        status = 409;
        message = 'Record already exists';
      } else if (error.code === '23503') {
        status = 400;
        message = 'Referenced record does not exist';
      } else if (error.code === '23514') {
        status = 400;
        message = 'Invalid record values';
      } else if (error.type === 'entity.parse.failed') {
        status = 400;
        message = 'Invalid JSON body';
      }
      if (status >= 500) {
        if (logger) console.error(error);
        message = 'Internal server error';
      }
      res.status(status).json({ error: message, statusCode: status });
    });
  }
  return { app, route, finish };
}
