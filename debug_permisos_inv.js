const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== DEBUG: USUARIO Y INVITACIONES ===\n');

        // Obtener todos los usuarios
        console.log('1. USUARIOS EN LA BD:');
        const usuarios = await pool.query(`
            SELECT idusuario, email, fullname FROM usuario ORDER BY idusuario
        `);
        
        usuarios.rows.forEach(u => {
            console.log(`   ID ${u.idusuario}: ${u.email} (${u.fullname})`);
        });

        // Obtener invitaciones pendientes
        console.log('\n2. INVITACIONES PENDIENTES:');
        const inv = await pool.query(`
            SELECT i.*, g.nombre as nombregrupo, u.fullname as nombreremitente
            FROM invitacion i
            JOIN grupo g ON i.idgrupo = g.idgrupo
            JOIN usuario u ON i.idremitente = u.idusuario
            WHERE i.estado = 'PENDIENTE'
            ORDER BY i.idinvitacion
        `);

        if (inv.rows.length === 0) {
            console.log('   (No hay invitaciones)');
        } else {
            inv.rows.forEach(row => {
                console.log(`   ID ${row.idinvitacion}: ${row.nombreremitente} (ID ${row.idremitente}) → ${row.emaildestinatario} (grupo: ${row.nombregrupo})`);
            });
        }

        // Ver cuál usuario tiene cuál email
        console.log('\n3. PREGUNTA: ¿Cuál es el email del usuario que intenta aceptar?');
        console.log('   (Verifica tu token JWT o los logs del frontend)');

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
