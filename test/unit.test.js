import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import YAML from 'yaml';
import { buildApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/domain.js';

test('passwords are salted and verified securely', async () => {
  const password = 'Demo-test-password!';
  const hash = await hashPassword(password);
  assert.notEqual(hash, await hashPassword(password));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('rejects a missing or weak JWT secret', async () => {
  await assert.rejects(buildApp({ jwtSecret: 'short' }), /JWT_SECRET/);
});

test('Swagger documents only login, current user and health', async () => {
  const app = await buildApp({
    jwtSecret: 'unit-test-secret-at-least-32-characters',
    pool: {}, logger: false,
  });
  const json = (await request(app).get('/docs/json')).body;
  assert.deepEqual(Object.keys(json.paths).sort(), ['/auth/login', '/auth/me', '/health']);
  assert.deepEqual(json.tags.map(tag => tag.name), ['Health', 'Auth']);
  assert.equal(json.paths['/auth/me'].get.security[0].bearerAuth.length, 0);
  assert.equal((await request(app).get('/docs/')).status, 200);
  const yaml = YAML.parse((await request(app).get('/docs/yaml')).text);
  assert.deepEqual(yaml, json);
  for (const path of ['/rooms', '/bookings', '/users']) {
    assert.equal((await request(app).get(path)).status, 404);
  }
});

test('validation and token failures return JSON errors', async () => {
  const app = await buildApp({
    jwtSecret: 'unit-test-secret-at-least-32-characters',
    pool: { query: () => { throw new Error('Invalid requests must not query the database'); } },
    logger: false,
  });
  assert.equal((await request(app).post('/auth/login').send({ email: 'invalid', password: 'a' })).status, 400);
  assert.equal((await request(app).post('/auth/login').send({ email: 'admin@example.com' })).status, 400);
  assert.equal((await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{bad')).status, 400);
  assert.equal((await request(app).get('/auth/me')).status, 401);
  assert.equal((await request(app).get('/auth/me').set('Authorization', 'Bearer invalid-token')).status, 401);
});
