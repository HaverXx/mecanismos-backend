const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('\n=== TODOS LOS USUARIOS ===');
        const usuarios = await pool.query(`SELECT idusuario, email, fullname FROM usuario`);
        console.log(usuarios.rows);

        console.log('\n=== TODOS LOS GRUPOS ===');
        const grupos = await pool.query(`SELECT * FROM grupo`);
        console.log(grupos.rows);

        console.log('\n=== TABLA USUARIO_GRUPO ===');
        const ug = await pool.query(`SELECT * FROM usuario_grupo ORDER BY idgrupo, idusuario`);
        console.log(ug.rows);

        // Para cada grupo, contar miembros
        console.log('\n=== CONTEO DE MIEMBROS POR GRUPO ===');
        const counts = await pool.query(`
            SELECT g.idgrupo, g.nombre, COUNT(ug.idusuario) as miembros_actuales
            FROM grupo g
            LEFT JOIN usuario_grupo ug ON g.idgrupo = ug.idgrupo
            GROUP BY g.idgrupo, g.nombre
        `);
        console.log(counts.rows);

        // Probar la query de mis-grupos para usuario 2
        console.log('\n=== QUERY MIS-GRUPOS PARA USUARIO 2 (CON DISTINCT) ===');
        const misgrupos = await pool.query(`
            SELECT DISTINCT g.idgrupo, g.idowner, g.nombre, g.descripcion, u.fullname as ownername,
                   (SELECT COUNT(*) FROM usuario_grupo ug WHERE ug.idgrupo = g.idgrupo) as membercount
            FROM grupo g
            JOIN usuario u ON g.idowner = u.idusuario
            WHERE g.idowner = 2
               OR g.idgrupo IN (SELECT idgrupo FROM usuario_grupo WHERE idusuario = 2)
        `);
        console.log('Resultado (debería ser sin duplicados):');
        console.log(misgrupos.rows);
        console.log(`Total de filas: ${misgrupos.rows.length}`);

        // Sin DISTINCT
        console.log('\n=== QUERY MIS-GRUPOS PARA USUARIO 2 (SIN DISTINCT) ===');
        const sinDistinct = await pool.query(`
            SELECT g.idgrupo, g.idowner, g.nombre, g.descripcion, u.fullname as ownername,
                   (SELECT COUNT(*) FROM usuario_grupo ug WHERE ug.idgrupo = g.idgrupo) as membercount
            FROM grupo g
            JOIN usuario u ON g.idowner = u.idusuario
            WHERE g.idowner = 2
               OR g.idgrupo IN (SELECT idgrupo FROM usuario_grupo WHERE idusuario = 2)
        `);
        console.log('Resultado (podría haber duplicados):');
        console.log(sinDistinct.rows);
        console.log(`Total de filas: ${sinDistinct.rows.length}`);

        // Probar query de miembros
        console.log('\n=== QUERY DE MIEMBROS PARA GRUPO 4 ===');
        if (grupos.rows.length > 0) {
            const idGrupo = grupos.rows[0].idgrupo;
            const miembros = await pool.query(`
                SELECT DISTINCT u.idusuario, u.email, u.fullname, u.empresa,
                       COALESCE((SELECT 1 FROM grupo WHERE idgrupo = $1 AND idowner = u.idusuario LIMIT 1), 0) as isowner
                FROM usuario_grupo ug
                JOIN usuario u ON ug.idusuario = u.idusuario
                WHERE ug.idgrupo = $1
            `, [idGrupo]);
            console.log(`Miembros del grupo ${idGrupo}:`);
            console.log(miembros.rows);
            console.log(`Total de miembros: ${miembros.rows.length}`);
        }

        // Probar verificación de acceso para usuario 2
        console.log('\n=== VERIFICACION DE ACCESO (QUERY CON LEFT JOIN) ===');
        if (grupos.rows.length > 0) {
            const idGrupo = grupos.rows[0].idgrupo;
            const access1 = await pool.query(`
                SELECT 1 FROM grupo g
                LEFT JOIN usuario_grupo ug ON g.idgrupo = ug.idgrupo
                WHERE g.idgrupo = $1 AND (g.idowner = $2 OR ug.idusuario = $2)
            `, [idGrupo, 2]);
            console.log(`Resultado de verificación (con LEFT JOIN):`);
            console.log(`Filas retornadas: ${access1.rows.length}`);
            if (access1.rows.length > 1) {
                console.log('⚠️ PROBLEMA: Múltiples filas retornadas!');
            }
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
