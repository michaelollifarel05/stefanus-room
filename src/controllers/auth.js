import { fail, verifyPassword, hashPassword } from '../domain.js';

const dummyHash = await hashPassword('unusable-random-placeholder');

export function createAuthController({ pool, signToken }) {
  const login = async (req, res) => {
    const { email, password } = req.body;
    const {
      rows: [user],
    } = await pool.query('SELECT * FROM users WHERE email=$1 AND active', [email.toLowerCase()]);
    // Run scrypt even for unknown emails to reduce account enumeration through timing.
    const valid = await verifyPassword(password, user?.password_hash ?? dummyHash);
    if (!user || !valid) fail(401, 'Invalid email or password');
    return { accessToken: signToken(user.id), tokenType: 'Bearer', expiresIn: 3600 };
  };

  const getCurrentUser = async (req) => req.user;

  return { login, getCurrentUser };
}
