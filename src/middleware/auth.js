import jwt from 'jsonwebtoken';
import { fail } from '../domain.js';

export const USER_COLUMNS = 'id,name,email,role,organization_id,active,created_at';

export function createAuthGuards(pool, secret) {
  const requireAuth = async (req) => {
    const match = /^Bearer ([^ ]+)$/i.exec(req.headers.authorization ?? '');
    if (!match) fail(401, 'Bearer token required');
    try {
      req.user = jwt.verify(match[1], secret, {
        algorithms: ['HS256'],
        issuer: 'st-stefanus-api',
        audience: 'st-stefanus',
      });
      if (
        typeof req.user.sub !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.user.sub)
      )
        fail(401, 'Invalid token subject');
    } catch {
      fail(401, 'Invalid or expired token');
    }
    const {
      rows: [user],
    } = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id=$1 AND active`, [
      req.user.sub,
    ]);
    if (!user) fail(401, 'User is inactive or does not exist');
    req.user = user;
  };
  return { requireAuth };
}
