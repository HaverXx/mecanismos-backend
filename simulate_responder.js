const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== SIMULACIÓN: ACEPTAR INVITACIÓN ID 9 COMO julenescles@gmail.com ===\n');

        // Simular: Usuario logueado es Julen (ID 1)
        const idUsuarioLogueado = 1;
        const idInvitacion = 9;

        console.log(`Paso 1: Obtener email del usuario logueado (ID ${idUsuarioLogueado})`);
        const user = await pool.query(`
            SELECT email FROM usuario WHERE idusuario = $1
        `, [idUsuarioLogueado]);

        if (user.rows.length === 0) {
            console.log('   ❌ Usuario NO encontrado');
            process.exit(1);
        }

        const emailUsuario = user.rows[0].email;
        console.log(`   ✅ Email del usuario: "${emailUsuario}"`);

        console.log(`\nPaso 2: Obtener invitación ID ${idInvitacion}`);
        const inv = await pool.query(`
            SELECT * FROM invitacion WHERE idinvitacion = $1
        `, [idInvitacion]);

        if (inv.rows.length === 0) {
            console.log('   ❌ Invitación NO encontrada');
            process.exit(1);
        }

        const emailDestinatario = inv.rows[0].emaildestinatario;
        console.log(`   ✅ Invitación encontrada`);
        console.log(`   emaildestinatario: "${emailDestinatario}"`);

        console.log(`\nPaso 3: Comparar emails`);
        console.log(`   emailUsuario (${emailUsuario.length} chars): "${emailUsuario}"`);
        console.log(`   emailDestinatario (${emailDestinatario.length} chars): "${emailDestinatario}"`);
        console.log(`   ¿SON IGUALES? ${emailDestinatario === emailUsuario}`);

        // Con normalización
        const normalized1 = emailDestinatario.trim().toLowerCase();
        const normalized2 = emailUsuario.trim().toLowerCase();
        console.log(`\n   (Normalizados)`);
        console.log(`   normalized1: "${normalized1}"`);
        console.log(`   normalized2: "${normalized2}"`);
        console.log(`   ¿SON IGUALES? ${normalized1 === normalized2}`);

        if (emailDestinatario === emailUsuario) {
            console.log('\n✅ LA INVITACIÓN DEBERÍA SER ACEPTABLE');
        } else {
            console.log('\n❌ ERROR: Los emails no coinciden!');
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
