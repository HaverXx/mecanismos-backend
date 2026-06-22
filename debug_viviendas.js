const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== ANÁLISIS DE VIVIENDAS Y PERMISOS ===\n');

        // 1. Ver todas las viviendas
        console.log('1. Todas las viviendas:');
        const viviendas = await pool.query(`
            SELECT v.idvivienda, v.nombre, v.idduenyo, v.idgrupo, u.fullname, g.nombre as grupo_nombre
            FROM vivienda v
            LEFT JOIN usuario u ON v.idduenyo = u.idusuario
            LEFT JOIN grupo g ON v.idgrupo = g.idgrupo
            ORDER BY v.idvivienda
        `);
        console.log(viviendas.rows);

        // 2. Para cada usuario, ver qué viviendas debería ver
        console.log('\n2. Viviendas visibles por usuario (según la query):');
        const usuarios = await pool.query('SELECT idusuario, fullname, email FROM usuario ORDER BY idusuario');
        
        for (const user of usuarios.rows) {
            console.log(`\n   Usuario ${user.idusuario} (${user.fullname} - ${user.email}):`);
            
            // Query igual a la del backend
            const viviendas_usuario = await pool.query(`
                SELECT DISTINCT v.idvivienda, v.nombre, v.idduenyo, v.idgrupo, u.fullname as owner_name, g.nombre as grupo_nombre
                FROM vivienda v
                LEFT JOIN usuario u ON v.idduenyo = u.idusuario
                LEFT JOIN grupo g ON v.idgrupo = g.idgrupo
                WHERE v.idduenyo = $1
                   OR v.idgrupo IN (SELECT idgrupo FROM usuario_grupo WHERE idusuario = $2)
                ORDER BY v.idvivienda
            `, [user.idusuario, user.idusuario]);
            
            if (viviendas_usuario.rows.length === 0) {
                console.log('      (Ninguna)');
            } else {
                viviendas_usuario.rows.forEach(v => {
                    let tipo = '';
                    if (v.idduenyo === user.idusuario) {
                        tipo = '(propia)';
                    } else if (v.idgrupo) {
                        tipo = `(compartida en grupo: ${v.grupo_nombre})`;
                    }
                    console.log(`      - ${v.nombre} ${tipo}`);
                });
            }
        }

        // 3. Verificar grupos y miembros
        console.log('\n3. Grupos y miembros:');
        const grupos_info = await pool.query(`
            SELECT g.idgrupo, g.nombre, g.idowner, u.fullname as owner_name,
                   (SELECT string_agg(u2.fullname, ', ') FROM usuario_grupo ug2 JOIN usuario u2 ON ug2.idusuario = u2.idusuario WHERE ug2.idgrupo = g.idgrupo) as miembros
            FROM grupo g
            LEFT JOIN usuario u ON g.idowner = u.idusuario
            ORDER BY g.idgrupo
        `);
        console.log(grupos_info.rows);

        // 4. Verificar viviendas sin propietario
        console.log('\n4. Viviendas sin propietario claro:');
        const sin_duenyo = await pool.query(`
            SELECT idvivienda, nombre, idduenyo, idgrupo
            FROM vivienda
            WHERE idduenyo IS NULL
        `);
        if (sin_duenyo.rows.length === 0) {
            console.log('   (Todas las viviendas tienen propietario)');
        } else {
            console.log(sin_duenyo.rows);
        }

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
