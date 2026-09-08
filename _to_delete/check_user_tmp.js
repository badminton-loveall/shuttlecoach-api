require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const exact = await pool.query("SELECT id, name, email, role, created_at FROM users WHERE email = $1", ['vmidhun@gmail.com']);
    console.log('Exact match for vmidhun@gmail.com:', JSON.stringify(exact.rows));

    const fuzzy = await pool.query("SELECT id, name, email, role, created_at FROM users WHERE email ILIKE $1", ['%midhun%']);
    console.log('Fuzzy match (%midhun%):', JSON.stringify(fuzzy.rows));

    const tokens = await pool.query(
      `SELECT prt.id, prt.user_id, prt.created_at, prt.expires_at, prt.used_at, u.email
       FROM password_reset_tokens prt
       LEFT JOIN users u ON u.id = prt.user_id
       ORDER BY prt.created_at DESC LIMIT 10`
    );
    console.log('Recent reset tokens:', JSON.stringify(tokens.rows));
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
