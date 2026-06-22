const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== DEBUG: INVITACIONES PARA julenescles@gmail.com ===\n');

        // Simular: El usuario logueado es julenescles@gmail.com (ID 1)
        const usuarioLogueado = 'julenescles@gmail.com';

        console.log(`1. Obtener datos del usuario: ${usuarioLogueado}`);
        const user = await pool.query(`
            SELECT email FROM usuario WHERE email = $1
        `, [usuarioLogueado]);

        if (user.rows.length === 0) {
            console.log('   ❌ Usuario NO encontrado');
        } else {
            console.log(`   ✅ Usuario encontrado: ${user.rows[0].email}`);

            // Simular lo que hace GET /invitaciones/recibidas
            console.log('\n2. Invitaciones pendientes PARA este email:');
            const invitaciones = await pool.query(`
                SELECT i.*, g.nombre as nombregrupo, u.fullname as nombreremitente
                FROM invitacion i
                JOIN grupo g ON i.idgrupo = g.idgrupo
                JOIN usuario u ON i.idremitente = u.idusuario
                WHERE i.emaildestinatario = $1 AND i.estado = 'PENDIENTE'
            `, [usuarioLogueado]);

            if (invitaciones.rows.length === 0) {
                console.log('   (No hay invitaciones)');
            } else {
                invitaciones.rows.forEach(inv => {
                    console.log(`   ✅ ID ${inv.idinvitacion}: ${inv.nombreremitente} → ${inv.emaildestinatario} (grupo: ${inv.nombregrupo})`);
                    console.log(`      emaildestinatario: "${inv.emaildestinatario}"`);
                    console.log(`      tipo: ${typeof inv.emaildestinatario}`);
                    console.log(`      longitud: ${inv.emaildestinatario ? inv.emaildestinatario.length : 'null'}`);
                });
            }
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
