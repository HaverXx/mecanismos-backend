const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fix() {
  try {
    console.log('Creando sequence...');
    await pool.query('CREATE SEQUENCE IF NOT EXISTS presupuesto_idpresupuesto_seq');
    
    console.log('Alterando tabla...');
    await pool.query(`
      ALTER TABLE presupuesto 
      ALTER COLUMN idpresupuesto SET DEFAULT nextval('presupuesto_idpresupuesto_seq')
    `);
    
    console.log('Configurando ownership de la sequence...');
    await pool.query(`
      ALTER SEQUENCE presupuesto_idpresupuesto_seq OWNED BY presupuesto.idpresupuesto
    `);
    
    console.log('✅ SEQUENCE ARREGLADA');
    
    // Verificar
    const res = await pool.query(`
      SELECT column_default FROM information_schema.columns
      WHERE table_name = 'presupuesto' AND column_name = 'idpresupuesto'
    `);
    console.log('Column default ahora:', res.rows[0].column_default);
    
    pool.end();
  } catch(e) {
    console.error('ERROR:', e.message);
    pool.end();
  }
}
fix();
