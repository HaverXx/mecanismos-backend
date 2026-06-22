const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('=== AÑADIENDO COLUMNA idusuario_destinatario ===\n');

        // Verificar si la columna ya existe
        const checkCol = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'invitacion' AND column_name = 'idusuario_destinatario'
        `);

        if (checkCol.rows.length > 0) {
            console.log('✅ La columna idusuario_destinatario ya existe');
        } else {
            console.log('Creando columna...');
            await pool.query(`
                ALTER TABLE invitacion 
                ADD COLUMN idusuario_destinatario INTEGER
            `);
            console.log('✅ Columna creada');

            // Poblarla con los datos existentes
            console.log('\nPoblando columna con datos existentes...');
            const result = await pool.query(`
                UPDATE invitacion i
                SET idusuario_destinatario = u.idusuario
                FROM usuario u
                WHERE i.emaildestinatario = u.email AND i.idusuario_destinatario IS NULL
                RETURNING i.idinvitacion
            `);
            console.log(`✅ ${result.rowCount} invitaciones actualizadas`);

            // Ver resultado
            const check = await pool.query(`
                SELECT 
                    i.idinvitacion, 
                    i.emaildestinatario, 
                    i.idusuario_destinatario,
                    u.fullname
                FROM invitacion i
                LEFT JOIN usuario u ON i.idusuario_destinatario = u.idusuario
                ORDER BY i.idinvitacion
            `);
            
            console.log('\nEstado de invitaciones:');
            check.rows.forEach(row => {
                console.log(`   ID ${row.idinvitacion}: ${row.emaildestinatario} → ${row.idusuario_destinatario} (${row.fullname || 'no encontrado'})`);
            });
        }

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
