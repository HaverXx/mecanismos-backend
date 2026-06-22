const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        // Primero limpiar usuario_grupo de duplicados
        console.log('🧹 Limpiando usuario_grupo...');
        await pool.query(`
            DELETE FROM usuario_grupo ug1
            WHERE ug1.ctid != (
                SELECT MIN(ug2.ctid) 
                FROM usuario_grupo ug2 
                WHERE ug2.idusuario = ug1.idusuario 
                AND ug2.idgrupo = ug1.idgrupo
            )
        `);
        
        // Luego limpiar grupo de duplicados
        console.log('🧹 Limpiando grupo...');
        await pool.query(`
            DELETE FROM grupo g1
            WHERE g1.ctid != (
                SELECT MIN(g2.ctid) 
                FROM grupo g2 
                WHERE g2.idgrupo = g1.idgrupo
            )
        `);

        // Verificar
        const grupos = await pool.query(`SELECT * FROM grupo ORDER BY idgrupo`);
        const ug = await pool.query(`SELECT * FROM usuario_grupo ORDER BY idgrupo, idusuario`);
        
        console.log('\n✅ Tabla grupo después de limpiar:');
        console.log(JSON.stringify(grupos.rows, null, 2));
        
        console.log('\n✅ Tabla usuario_grupo después de limpiar:');
        console.log(JSON.stringify(ug.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
