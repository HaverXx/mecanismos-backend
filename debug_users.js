const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('\n=== VERIFICAR DUPLICADOS EN USUARIO ===');
        const duplicados = await pool.query(`
            SELECT email, fullname, COUNT(*) as veces
            FROM usuario
            GROUP BY email, fullname
            HAVING COUNT(*) > 1
            ORDER BY veces DESC
        `);
        console.log('Usuarios duplicados:');
        if (duplicados.rows.length === 0) {
            console.log('No hay duplicados detectados por email/fullname');
        } else {
            console.log(duplicados.rows);
        }

        console.log('\n=== TODOS LOS REGISTROS DE USUARIO ===');
        const allUsers = await pool.query(`
            SELECT idusuario, email, fullname FROM usuario ORDER BY idusuario
        `);
        allUsers.rows.forEach(u => {
            console.log(`ID: ${u.idusuario}, Email: ${u.email}, Name: ${u.fullname}`);
        });
        console.log(`Total registros usuario: ${allUsers.rows.length}`);

        console.log('\n=== VERIFICAR INTEGRIDAD DE USUARIO_GRUPO ===');
        const ug = await pool.query(`
            SELECT ug.*, u.email as user_email, g.nombre as grupo_nombre
            FROM usuario_grupo ug
            LEFT JOIN usuario u ON ug.idusuario = u.idusuario
            LEFT JOIN grupo g ON ug.idgrupo = g.idgrupo
            ORDER BY ug.idgrupo, ug.idusuario
        `);
        console.log('Relaciones usuario_grupo:');
        console.log(ug.rows);

        // Verificar si hay usuarios duplicados en usuario_grupo
        console.log('\n=== BUSCAR DUPLICADOS EN USUARIO_GRUPO ===');
        const dupUG = await pool.query(`
            SELECT idusuario, idgrupo, COUNT(*) as veces
            FROM usuario_grupo
            GROUP BY idusuario, idgrupo
            HAVING COUNT(*) > 1
        `);
        console.log('Duplicados en usuario_grupo:');
        if (dupUG.rows.length === 0) {
            console.log('No hay duplicados');
        } else {
            console.log(dupUG.rows);
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
