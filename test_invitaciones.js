const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== PRUEBA DE INVITACIONES ===\n');

        // 1. Verificar datos
        console.log('1. Estado actual:');
        const invitaciones = await pool.query(`
            SELECT i.idinvitacion, u.fullname as remitente, i.emaildestinatario, g.nombre as grupo, i.estado
            FROM invitacion i
            JOIN usuario u ON i.idremitente = u.idusuario
            JOIN grupo g ON i.idgrupo = g.idgrupo
            ORDER BY i.idinvitacion
        `);
        
        if (invitaciones.rows.length === 0) {
            console.log('   (No hay invitaciones)');
        } else {
            invitaciones.rows.forEach(inv => {
                console.log(`   ID ${inv.idinvitacion}: ${inv.remitente} → ${inv.emaildestinatario} (grupo: ${inv.grupo}, estado: ${inv.estado})`);
            });
        }

        // 2. Simular búsqueda de invitación (como lo hace el backend)
        if (invitaciones.rows.length > 0) {
            const testInv = invitaciones.rows[0];
            console.log(`\n2. Probando búsqueda de invitación ID ${testInv.idinvitacion}:`);
            
            const inv = await pool.query(`
                SELECT * FROM invitacion WHERE idinvitacion = $1
            `, [testInv.idinvitacion]);
            
            if (inv.rows.length === 0) {
                console.log('   ❌ NO ENCONTRADA');
            } else {
                console.log('   ✅ ENCONTRADA');
                console.log(`      ${JSON.stringify(inv.rows[0])}`);
            }

            // 3. Verificar que Juanete existe
            console.log('\n3. Verificando usuarios:');
            const user = await pool.query(`
                SELECT idusuario, email, fullname FROM usuario WHERE email = $1
            `, [testInv.emaildestinatario]);
            
            if (user.rows.length === 0) {
                console.log(`   ❌ Usuario ${testInv.emaildestinatario} NO EXISTE`);
            } else {
                console.log(`   ✅ Usuario ${testInv.emaildestinatario} EXISTE (ID: ${user.rows[0].idusuario})`);
            }

            // 4. Simular aceptar invitación
            console.log(`\n4. Simulando aceptación de invitación:`);
            
            // Verificar si el usuario ya está en el grupo
            const member = await pool.query(`
                SELECT 1 FROM usuario_grupo 
                WHERE idusuario = $1 AND idgrupo = $2
            `, [user.rows[0].idusuario, inv.rows[0].idgrupo]);
            
            if (member.rows.length > 0) {
                console.log('   ℹ️ El usuario ya es miembro');
            } else {
                console.log('   El usuario será agregado al grupo');
                const insert = await pool.query(`
                    INSERT INTO usuario_grupo (idusuario, idgrupo) VALUES ($1, $2)
                    ON CONFLICT (idusuario, idgrupo) DO NOTHING
                `, [user.rows[0].idusuario, inv.rows[0].idgrupo]);
                console.log(`   ✅ Agregado (${insert.rowCount} filas)`);
            }
        }

        console.log('\n✅ Prueba completada!');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
