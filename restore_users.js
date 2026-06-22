const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Restaurando usuarios eliminados accidentalmente...\n');

        // Restaurar los usuarios basado en la información que teníamos
        const usuarios = [
            { id: 1, email: 'julenescles@gmail.com', fullname: 'Julen Escosteguy Lescano', password: null },
            { id: 2, email: 'juanete@gmail.com', fullname: 'Juanete', password: null },
            { id: 3, email: 'test@example.com', fullname: 'Test User', password: null }
        ];

        for (const user of usuarios) {
            // Insertar usuario
            await pool.query(`
                INSERT INTO usuario (idusuario, email, fullname)
                VALUES ($1, $2, $3)
            `, [user.id, user.email, user.fullname]);
            console.log(`Restaurado usuario: ${user.email} (ID: ${user.id})`);
        }

        // Verificar
        const count = await pool.query(`SELECT COUNT(*) FROM usuario`);
        console.log(`\n✅ Total usuarios restaurados: ${count.rows[0].count}`);

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
