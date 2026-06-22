const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        // Suponiendo que el usuario 2 es Juanete
        const userId = 2;

        console.log('\n=== GRUPO ACTUAL ===');
        const grupos = await pool.query(`SELECT * FROM grupo`);
        console.log(JSON.stringify(grupos.rows, null, 2));

        console.log('\n=== USUARIO_GRUPO ===');
        const ug = await pool.query(`SELECT * FROM usuario_grupo`);
        console.log(JSON.stringify(ug.rows, null, 2));

        console.log(`\n=== QUERY MIS-GRUPOS PARA USER ${userId} ===`);
        const result = await pool.query(`
            SELECT DISTINCT g.idgrupo, g.idowner, g.nombre, g.descripcion, u.fullname as ownername,
                   (SELECT COUNT(*) FROM usuario_grupo ug WHERE ug.idgrupo = g.idgrupo) as membercount
            FROM grupo g
            JOIN usuario u ON g.idowner = u.idusuario
            WHERE g.idowner = $1 
               OR g.idgrupo IN (SELECT idgrupo FROM usuario_grupo WHERE idusuario = $2)
        `, [userId, userId]);
        
        console.log('Resultado de mis-grupos:');
        console.log(JSON.stringify(result.rows, null, 2));

        console.log('\n=== VERIFICAR PROPIETARIO ===');
        const owner = await pool.query(`SELECT * FROM grupo WHERE idowner = $1`, [userId]);
        console.log('Grupos que owns el usuario:', JSON.stringify(owner.rows, null, 2));

        console.log('\n=== VERIFICAR MIEMBRO ===');
        const member = await pool.query(`SELECT * FROM usuario_grupo WHERE idusuario = $1`, [userId]);
        console.log('Grupos donde es miembro:', JSON.stringify(member.rows, null, 2));

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
