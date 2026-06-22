const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Iniciando limpieza de datos...\n');

        // 1. Limpiar usuarios duplicados (mantener solo los 3 correctos)
        console.log('1. Limpiando usuarios duplicados...');
        const deleteUsers = await pool.query(`
            DELETE FROM usuario
            WHERE idusuario > 3
        `);
        console.log(`   ✅ Eliminados ${deleteUsers.rowCount} usuarios duplicados\n`);

        // 2. Eliminar viviendas duplicadas (mantener solo una de cada)
        console.log('2. Limpiando viviendas duplicadas...');
        const deleteViv = await pool.query(`
            WITH dup_rows AS (
                SELECT 
                    idvivienda,
                    ROW_NUMBER() OVER (PARTITION BY idvivienda ORDER BY idvivienda) as rn
                FROM vivienda
            )
            DELETE FROM vivienda 
            WHERE (idvivienda) IN (
                SELECT idvivienda FROM dup_rows WHERE rn > 1
            )
        `);
        console.log(`   ✅ Eliminadas ${deleteViv.rowCount} viviendas duplicadas\n`);

        // 3. Eliminar las viviendas sin propietario
        console.log('3. Eliminando viviendas sin propietario...');
        const deleteNoOwner = await pool.query(`
            DELETE FROM vivienda
            WHERE idduenyo IS NULL
        `);
        console.log(`   ✅ Eliminadas ${deleteNoOwner.rowCount} viviendas sin propietario\n`);

        // 4. Verificación
        console.log('4. Verificación final:');
        const usersCount = await pool.query(`SELECT COUNT(*) FROM usuario`);
        const vivCount = await pool.query(`SELECT COUNT(*) FROM vivienda`);
        const groupsCount = await pool.query(`SELECT COUNT(*) FROM grupo`);
        
        console.log(`   Usuarios: ${usersCount.rows[0].count}`);
        console.log(`   Viviendas: ${vivCount.rows[0].count}`);
        console.log(`   Grupos: ${groupsCount.rows[0].count}\n`);

        // 5. Mostrar datos limpios
        console.log('5. Datos limpios:');
        console.log('\n   Usuarios:');
        const users = await pool.query('SELECT idusuario, email, fullname FROM usuario ORDER BY idusuario');
        users.rows.forEach(u => console.log(`     - ${u.fullname} (${u.email})`));

        console.log('\n   Viviendas:');
        const viviendas = await pool.query(`
            SELECT v.idvivienda, v.nombre, u.fullname as owner
            FROM vivienda v
            LEFT JOIN usuario u ON v.idduenyo = u.idusuario
            ORDER BY v.idvivienda
        `);
        if (viviendas.rows.length === 0) {
            console.log('     (Ninguna)');
        } else {
            viviendas.rows.forEach(v => console.log(`     - ${v.nombre} (propietario: ${v.owner})`));
        }

        console.log('\n✅ Limpieza completada!');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
