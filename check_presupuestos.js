const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  try {
    // Check presupuesto table
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'presupuesto' 
      ORDER BY ordinal_position
    `);
    console.log('=== TABLA PRESUPUESTO ===');
    res.rows.forEach(r => console.log(r.column_name + ': ' + r.data_type));
    
    // Check first presupuesto
    const res2 = await pool.query('SELECT * FROM presupuesto LIMIT 1');
    console.log('\n=== PRIMER PRESUPUESTO ===');
    if (res2.rows.length > 0) {
      console.log(JSON.stringify(res2.rows[0], null, 2));
    } else {
      console.log('NO HAY PRESUPUESTOS');
    }
    
    // Check count
    const res3 = await pool.query('SELECT COUNT(*) as total FROM presupuesto');
    console.log('\n=== TOTAL PRESUPUESTOS:', res3.rows[0].total);
    
    pool.end();
  } catch(e) {
    console.error('ERROR:', e.message);
    pool.end();
  }
}
check();
