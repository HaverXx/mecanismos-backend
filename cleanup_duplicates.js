const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Iniciando limpieza de duplicados...\n');

        // 1. Limpiar usuario_grupo duplicados (mantener solo el primero)
        console.log('1. Limpiando duplicados en usuario_grupo...');
        const deleteUG = await pool.query(`
            WITH dup_rows AS (
                SELECT 
                    idusuario, 
                    idgrupo,
                    ROW_NUMBER() OVER (PARTITION BY idusuario, idgrupo ORDER BY idusuario, idgrupo) as rn
                FROM usuario_grupo
            )
            DELETE FROM usuario_grupo 
            WHERE (idusuario, idgrupo) IN (
                SELECT idusuario, idgrupo FROM dup_rows WHERE rn > 1
            )
        `);
        console.log(`   Duplicados eliminados: ${deleteUG.rowCount}\n`);

        // 2. Limpiar usuario duplicados (mantener solo el primero de cada email)
        console.log('2. Limpiando duplicados en usuario...');
        const deleteUsers = await pool.query(`
            WITH dup_rows AS (
                SELECT 
                    idusuario,
                    email,
                    fullname,
                    ROW_NUMBER() OVER (PARTITION BY email, fullname ORDER BY idusuario) as rn
                FROM usuario
            )
            DELETE FROM usuario
            WHERE idusuario IN (
                SELECT idusuario FROM dup_rows WHERE rn > 1
            )
        `);
        console.log(`   Usuarios duplicados eliminados: ${deleteUsers.rowCount}\n`);

        // 3. Verificar resultados
        console.log('3. Verificación final...');
        const usersCount = await pool.query(`SELECT COUNT(*) FROM usuario`);
        const ugCount = await pool.query(`SELECT COUNT(*) FROM usuario_grupo`);
        console.log(`   Total usuarios: ${usersCount.rows[0].count}`);
        console.log(`   Total relaciones usuario_grupo: ${ugCount.rows[0].count}\n`);

        console.log('✅ Limpieza completada!');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
