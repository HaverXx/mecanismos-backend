const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  try {
    const res = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'presupuesto'
    `);
    console.log('=== CONSTRAINTS ===');
    console.log(res.rows);
    
    const res2 = await pool.query(`
      SELECT * FROM information_schema.sequences WHERE sequence_name LIKE '%presupuesto%'
    `);
    console.log('\n=== SEQUENCES ===');
    console.log(res2.rows);
    
    // Check column details
    const res3 = await pool.query(`
      SELECT column_name, column_default, is_identity
      FROM information_schema.columns
      WHERE table_name = 'presupuesto' AND column_name = 'idpresupuesto'
    `);
    console.log('\n=== IDPRESUPUESTO COLUMN ===');
    console.log(res3.rows);
    
    pool.end();
  } catch(e) {
    console.error('ERROR:', e.message);
    pool.end();
  }
}
check();
