const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        // Ver todos los grupos
        const grupos = await pool.query(`SELECT * FROM grupo`);
        console.log('\n=== GRUPOS ===');
        console.log(JSON.stringify(grupos.rows, null, 2));

        // Ver usuario_grupo
        const ug = await pool.query(`SELECT * FROM usuario_grupo ORDER BY idgrupo, idusuario`);
        console.log('\n=== USUARIO_GRUPO ===');
        console.log(JSON.stringify(ug.rows, null, 2));

        // Contar por grupo
        const count = await pool.query(`
            SELECT idgrupo, idusuario, COUNT(*) as duplicados 
            FROM usuario_grupo 
            GROUP BY idgrupo, idusuario 
            ORDER BY idgrupo
        `);
        console.log('\n=== DUPLICADOS POR GRUPO/USUARIO ===');
        console.log(JSON.stringify(count.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
