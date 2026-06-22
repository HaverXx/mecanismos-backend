const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Limpieza definitiva y fix de constraints...\n');

        // 1. Eliminar registros duplicados de usuario (mantener solo el primero de cada ID)
        console.log('1. Eliminando usuarios duplicados...');
        
        // Para idusuario 2: mantener juanete@gmail.com, eliminar prueba@gmail.com
        let del = await pool.query(`
            DELETE FROM usuario
            WHERE idusuario = 2 AND email = 'prueba@gmail.com'
        `);
        console.log(`   ✅ Eliminado usuario 2 (prueba@gmail.com): ${del.rowCount} registros`);

        // Para idusuario 3: mantener test@example.com, eliminar prueba2@gmail.com
        del = await pool.query(`
            DELETE FROM usuario
            WHERE idusuario = 3 AND email = 'prueba2@gmail.com'
        `);
        console.log(`   ✅ Eliminado usuario 3 (prueba2@gmail.com): ${del.rowCount} registros\n`);

        // 2. Eliminar viviendas duplicadas
        console.log('2. Eliminando viviendas duplicadas...');
        
        // Eliminar la segunda copia de cada vivienda duplicada
        del = await pool.query(`
            WITH dup_rows AS (
                SELECT 
                    ctid,
                    idvivienda,
                    ROW_NUMBER() OVER (PARTITION BY idvivienda ORDER BY ctid) as rn
                FROM vivienda
            )
            DELETE FROM vivienda
            WHERE ctid IN (
                SELECT ctid FROM dup_rows WHERE rn > 1
            )
        `);
        console.log(`   ✅ Eliminadas ${del.rowCount} viviendas duplicadas\n`);

        // 3. Agregar PRIMARY KEY a usuario
        console.log('3. Agregando PRIMARY KEY a usuario...');
        try {
            await pool.query(`
                ALTER TABLE usuario
                ADD PRIMARY KEY (idusuario)
            `);
            console.log('   ✅ PRIMARY KEY agregado a usuario\n');
        } catch (err) {
            console.log(`   ℹ️ PRIMARY KEY ya existe o error: ${err.message}\n`);
        }

        // 4. Agregar PRIMARY KEY a vivienda
        console.log('4. Agregando PRIMARY KEY a vivienda...');
        try {
            await pool.query(`
                ALTER TABLE vivienda
                ADD PRIMARY KEY (idvivienda)
            `);
            console.log('   ✅ PRIMARY KEY agregado a vivienda\n');
        } catch (err) {
            console.log(`   ℹ️ PRIMARY KEY ya existe o error: ${err.message}\n`);
        }

        // 5. Verificación final
        console.log('5. Estado final:');
        const users = await pool.query(`SELECT idusuario, email, fullname FROM usuario ORDER BY idusuario`);
        console.log(`\n   Usuarios (${users.rows.length}):`);
        users.rows.forEach(u => console.log(`     - ID ${u.idusuario}: ${u.fullname} (${u.email})`));

        const viviendas = await pool.query(`
            SELECT v.idvivienda, v.nombre, u.fullname
            FROM vivienda v
            LEFT JOIN usuario u ON v.idduenyo = u.idusuario
            ORDER BY v.idvivienda
        `);
        console.log(`\n   Viviendas (${viviendas.rows.length}):`);
        viviendas.rows.forEach(v => console.log(`     - ${v.nombre} → ${v.fullname}`));

        console.log('\n✅ Limpieza y fixes completados!');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
