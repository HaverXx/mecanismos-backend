const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== VERIFICACIÓN FINAL DEL SISTEMA ===\n');

        // 1. Verificar usuarios
        console.log('1. Usuarios:');
        const usuarios = await pool.query('SELECT COUNT(*) FROM usuario');
        console.log(`   Total: ${usuarios.rows[0].count}`);

        // 2. Verificar grupos
        console.log('\n2. Grupos:');
        const grupos = await pool.query('SELECT COUNT(*) FROM grupo');
        console.log(`   Total: ${grupos.rows[0].count}`);

        // 3. Verificar usuario_grupo
        console.log('\n3. Relaciones usuario-grupo:');
        const ug = await pool.query('SELECT COUNT(*) FROM usuario_grupo');
        console.log(`   Total: ${ug.rows[0].count}`);

        // 4. Verificar constraints
        console.log('\n4. Constraints:');
        const constraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name IN ('usuario_grupo', 'usuario', 'grupo')
            ORDER BY table_name, constraint_name
        `);
        
        const byTable = {};
        constraints.rows.forEach(c => {
            if (!byTable[c.table_name]) byTable[c.table_name] = [];
            byTable[c.table_name].push(`${c.constraint_name} (${c.constraint_type})`);
        });

        Object.entries(byTable).forEach(([table, constrs]) => {
            console.log(`   ${table}:`);
            constrs.forEach(c => console.log(`     - ${c}`));
        });

        // 5. Datos de prueba para mis-grupos
        console.log('\n5. Prueba de query mis-grupos para usuario 2:');
        const misgrupos = await pool.query(`
            SELECT DISTINCT g.idgrupo, g.nombre,
                   (SELECT COUNT(*) FROM usuario_grupo ug WHERE ug.idgrupo = g.idgrupo) as membercount
            FROM grupo g
            WHERE g.idowner = 2 
               OR g.idgrupo IN (SELECT idgrupo FROM usuario_grupo WHERE idusuario = 2)
        `);
        console.log(`   Grupos: ${misgrupos.rows.length}`);
        misgrupos.rows.forEach(g => {
            console.log(`     - ${g.nombre} (${g.membercount} miembros)`);
        });

        console.log('\n✅ Verificación completada\n');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
