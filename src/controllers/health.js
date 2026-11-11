export function createHealthController({ pool }) {
  const checkHealth = async () => {
    await pool.query('SELECT 1');
    return { status: 'ok' };
  };

  return { checkHealth };
}
