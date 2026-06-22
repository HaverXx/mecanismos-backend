const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== TEST COMPLETO: ACEPTAR INVITACIÓN 9 COMO JULEN ===\n');

        // Simular que Julen (ID 1) intenta aceptar invitación 9
        const idUsuarioLogueado = 1;
        const idInvitacion = 9;
        const accion = 'aceptar';

        // PASO 1: Obtener email del usuario logueado
        console.log(`PASO 1: Obtener email del usuario (ID ${idUsuarioLogueado})`);
        const userRes = await pool.query(`
            SELECT email FROM usuario WHERE idusuario = $1
        `, [idUsuarioLogueado]);

        if (userRes.rows.length === 0) {
            console.log('❌ FALLO: Usuario NO encontrado');
            await pool.end();
            return;
        }

        const user = userRes.rows[0];
        console.log(`✅ Email encontrado: "${user.email}"`);

        // PASO 2: Obtener invitación
        console.log(`\nPASO 2: Obtener invitación (ID ${idInvitacion})`);
        const invRes = await pool.query(`
            SELECT * FROM invitacion WHERE idinvitacion = $1
        `, [idInvitacion]);

        if (invRes.rows.length === 0) {
            console.log('❌ FALLO: Invitación NO encontrada');
            await pool.end();
            return;
        }

        const inv = invRes.rows[0];
        console.log(`✅ Invitación encontrada`);
        console.log(`   - emaildestinatario: "${inv.emaildestinatario}"`);
        console.log(`   - idgrupo: ${inv.idgrupo}`);
        console.log(`   - idremitente: ${inv.idremitente}`);
        console.log(`   - estado: ${inv.estado}`);

        // PASO 3: Comparar emails (como lo hace el servidor)
        console.log(`\nPASO 3: Validar permisos`);
        const emailDestinatario = inv.emaildestinatario ? inv.emaildestinatario.trim().toLowerCase() : '';
        const emailUsuario = user.email ? user.email.trim().toLowerCase() : '';
        
        console.log(`   - emailUsuario: "${emailUsuario}"`);
        console.log(`   - emailDestinatario: "${emailDestinatario}"`);
        console.log(`   - ¿SON IGUALES? ${emailDestinatario === emailUsuario}`);

        if (emailDestinatario !== emailUsuario) {
            console.log(`❌ FALLO: Permisos denegados`);
            console.log(`   Los emails no coinciden: "${emailDestinatario}" vs "${emailUsuario}"`);
            await pool.end();
            return;
        }

        // PASO 4: Actualizar estado
        console.log(`\nPASO 4: Actualizar estado de invitación`);
        const nuevoEstado = accion === 'aceptar' ? 'ACEPTADA' : 'RECHAZADA';
        const updateRes = await pool.query(
            `UPDATE invitacion SET estado = $1 WHERE idinvitacion = $2 RETURNING *`,
            [nuevoEstado, idInvitacion]
        );
        console.log(`✅ Estado actualizado a: ${nuevoEstado}`);

        // PASO 5: Agregar usuario al grupo
        if (accion === 'aceptar') {
            console.log(`\nPASO 5: Agregar usuario al grupo`);
            const insertRes = await pool.query(
                `INSERT INTO usuario_grupo (idusuario, idgrupo) VALUES ($1, $2)
                 ON CONFLICT (idusuario, idgrupo) DO NOTHING
                 RETURNING *`,
                [idUsuarioLogueado, inv.idgrupo]
            );
            console.log(`✅ Usuario agregado al grupo ${inv.idgrupo}`);
        }

        console.log(`\n✅ TODO CORRECTO - La invitación debería ser aceptada sin problemas`);

        await pool.end();
    } catch (err) {
        console.error('❌ ERROR:', err.message);
    }
})();
