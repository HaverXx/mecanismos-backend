const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== VERIFICACIÓN DE INVITACIONES ===\n');

        // 1. Ver estructura de la tabla
        console.log('1. Estructura de la tabla invitacion:');
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'invitacion'
            ORDER BY ordinal_position
        `);
        
        if (columns.rows.length === 0) {
            console.log('   ⚠️ La tabla invitacion NO existe');
        } else {
            columns.rows.forEach(c => {
                console.log(`   - ${c.column_name} (${c.data_type}) ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
        }

        // 2. Ver todas las invitaciones
        console.log('\n2. Invitaciones en la base de datos:');
        try {
            const inv = await pool.query(`SELECT * FROM invitacion`);
            if (inv.rows.length === 0) {
                console.log('   (Ninguna invitación)');
            } else {
                inv.rows.forEach(i => {
                    console.log(`   ID: ${JSON.stringify(i)}`);
                });
            }
        } catch (err) {
            console.log(`   Error: ${err.message}`);
        }

        // 3. Ver estructura de usuario_grupo
        console.log('\n3. Relaciones usuario_grupo:');
        const ug = await pool.query(`SELECT * FROM usuario_grupo`);
        ug.rows.forEach(r => {
            console.log(`   Usuario ${r.idusuario} → Grupo ${r.idgrupo}`);
        });

        // 4. Ver grupos
        console.log('\n4. Grupos:');
        const grupos = await pool.query(`
            SELECT idgrupo, nombre, idowner FROM grupo
        `);
        grupos.rows.forEach(g => {
            console.log(`   ${g.idgrupo}: ${g.nombre} (propietario: ${g.idowner})`);
        });

        // 5. Ver usuarios
        console.log('\n5. Usuarios:');
        const users = await pool.query(`
            SELECT idusuario, email, fullname FROM usuario
        `);
        users.rows.forEach(u => {
            console.log(`   ${u.idusuario}: ${u.fullname} (${u.email})`);
        });

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
