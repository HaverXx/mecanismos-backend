const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Verificando datos de usuario...\n');

        // Ver la estructura de la tabla
        console.log('Estructura de usuario:');
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'usuario'
            ORDER BY ordinal_position
        `);
        columns.rows.forEach(c => {
            console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''} ${c.column_default ? `DEFAULT ${c.column_default}` : ''}`);
        });

        // Ver constraints
        console.log('\nConstraints en usuario:');
        const constraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'usuario'
        `);
        constraints.rows.forEach(c => console.log(`  ${c.constraint_name}: ${c.constraint_type}`));

        // Ver datos exactos
        console.log('\nDatos en usuario (sin mapeo):');
        const rawData = await pool.query(`SELECT * FROM usuario ORDER BY idusuario, email`);
        rawData.rows.forEach(row => {
            console.log(`  ${JSON.stringify(row)}`);
        });

        // Contar duplicados
        console.log('\nBuscando duplicados por ID:');
        const dups = await pool.query(`
            SELECT idusuario, COUNT(*) as cnt
            FROM usuario
            GROUP BY idusuario
            ORDER BY cnt DESC
        `);
        dups.rows.forEach(d => console.log(`  idusuario ${d.idusuario}: ${d.cnt} registros`));

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
