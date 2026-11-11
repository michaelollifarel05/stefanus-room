import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/db.js';
import { migrate } from '../scripts/migrate.js';
import { seed } from '../scripts/seed.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated database ending in _test. Tests erase its application data.');
}

test('login against real PostgreSQL with the complete database design', async t => {
  const pool = createPool(url);
  const secret = 'integration-secret-at-least-32-characters';
  const password = 'Login-integration-password!';
  try {
    await migrate(pool);
    await migrate(pool);
    await pool.query('TRUNCATE audit_logs,bookings,users,rooms,organizations RESTART IDENTITY CASCADE');
    await seed(pool, password);
    await seed(pool, 'Another-password-not-used-to-reset-existing-users');
    const app = await buildApp({ pool, jwtSecret: secret, logger: false });
    let adminToken;

    await t.test('full schema and seed data are preserved', async () => {
      const { rows } = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
      for (const table of ['users','organizations','rooms','bookings','audit_logs','schema_migrations']) {
        assert.ok(rows.some(row => row.tablename === table), table);
      }
      assert.equal((await pool.query('SELECT * FROM users')).rowCount, 3);
      assert.equal((await pool.query('SELECT * FROM rooms')).rowCount, 2);
      assert.equal((await request(app).get('/health')).status, 200);
    });

    await t.test('all three demo roles can login and get their profile', async () => {
      for (const [email, role] of [
        ['admin@ststefanus.test','ADMIN'],
        ['secretariat@ststefanus.test','SECRETARIAT'],
        ['member@ststefanus.test','MEMBER'],
      ]) {
        const login = await request(app).post('/auth/login').send({ email, password });
        assert.equal(login.status, 200, login.text);
        assert.equal(login.body.expiresIn, 3600);
        const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
        assert.equal(me.status, 200, me.text);
        assert.equal(me.body.email, email);
        assert.equal(me.body.role, role);
        assert.equal(me.text.includes('password_hash'), false);
        if (role === 'ADMIN') adminToken = login.body.accessToken;
      }
    });

    await t.test('wrong password, unknown email and expired token fail', async () => {
      for (const [email, invalidPassword] of [
        ['admin@ststefanus.test','wrong-password'],
        ['missing@ststefanus.test',password],
      ]) {
        const login = await request(app).post('/auth/login').send({ email, password: invalidPassword });
        assert.equal(login.status, 401);
        assert.equal(login.body.error, 'Invalid email or password');
      }
      const { sub } = jwt.verify(adminToken, secret);
      const expired = jwt.sign({ sub }, secret, { expiresIn: -1, issuer: 'st-stefanus-api', audience: 'st-stefanus' });
      assert.equal((await request(app).get('/auth/me').set('Authorization', `Bearer ${expired}`)).status, 401);
    });

    await t.test('deactivation immediately revokes access', async () => {
      await pool.query("UPDATE users SET active=false WHERE email='admin@ststefanus.test'");
      assert.equal((await request(app).get('/auth/me').set('Authorization', `Bearer ${adminToken}`)).status, 401);
      assert.equal((await request(app).post('/auth/login').send({ email: 'admin@ststefanus.test', password })).status, 401);
    });
  } finally { await pool.end(); }
});
