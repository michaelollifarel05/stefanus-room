import { pathToFileURL } from 'node:url';
import { createPool, transaction } from '../src/db.js';
import { hashPassword } from '../src/domain.js';
export async function seed(pool, password) {
  if (!password || password.length < 12) throw new Error('Set SEED_PASSWORD with at least 12 characters');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production');
  const hash = await hashPassword(password);
  await transaction(pool, async client => {
    const { rows: [org] } = await client.query("INSERT INTO organizations(name) VALUES('OMK') ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id");
    for (const [name, email, role] of [
      ['Demo Administrator', 'admin@ststefanus.test', 'ADMIN'],
      ['Demo Secretariat', 'secretariat@ststefanus.test', 'SECRETARIAT'],
      ['Demo Member', 'member@ststefanus.test', 'MEMBER']
    ]) await client.query('INSERT INTO users(name,email,password_hash,role,organization_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING', [name,email,hash,role,org.id]);
    await client.query("INSERT INTO rooms(name,capacity,location,facilities) VALUES ('Aula St Stefanus',200,'Main building','Chairs, projector, sound system'),('Meeting Room',20,'First floor','Table, whiteboard') ON CONFLICT(name) DO NOTHING");
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool();
  try { await seed(pool, process.env.SEED_PASSWORD); console.log('Demo users and rooms ready (existing user passwords preserved)'); }
  finally { await pool.end(); }
}
