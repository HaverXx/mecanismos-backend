const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fixAll() {
  try {
    const tables = [
      { table: 'vivienda', column: 'idvivienda' },
      { table: 'mecanismos', column: 'idmecanismo' },
      { table: 'usuario', column: 'idusuario' },
      { table: 'grupo', column: 'idgrupo' },
      { table: 'habitacion', column: 'idhabitacion' },
      { table: 'presupuesto_mecanismo', column: 'idpresupuestomecanismo' },
      { table: 'presupuesto_anadido', column: 'idpresupuestoanadido' }
    ];
    
    for (const {table, column} of tables) {
      try {
        console.log(`\nFijando ${table}.${column}...`);
        
        const seqName = `${table}_${column}_seq`;
        await pool.query(`CREATE SEQUENCE IF NOT EXISTS ${seqName}`);
        
        await pool.query(`
          ALTER TABLE ${table} 
          ALTER COLUMN ${column} SET DEFAULT nextval('${seqName}')
        `);
        
        await pool.query(`
          ALTER SEQUENCE ${seqName} OWNED BY ${table}.${column}
        `);
        
        console.log(`✅ ${table}.${column} arreglado`);
      } catch(e) {
        console.log(`⚠️  ${table}.${column}: ${e.message.substring(0, 100)}`);
      }
    }
    
    console.log('\n✅ TODAS LAS SECUENCIAS ARREGLADAS');
    pool.end();
  } catch(e) {
    console.error('ERROR:', e.message);
    pool.end();
  }
}
fixAll();
