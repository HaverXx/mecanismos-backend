const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Actualizando contraseña del usuario julenescles@gmail.com...\n');

        // 1. Buscar el usuario
        const usuario = await pool.query(
            'SELECT idusuario, email, password FROM usuario WHERE email = $1',
            ['julenescles@gmail.com']
        );

        if (usuario.rows.length === 0) {
            console.log('❌ Usuario no encontrado');
            await pool.end();
            return;
        }

        console.log('Usuario encontrado:');
        console.log(`  ID: ${usuario.rows[0].idusuario}`);
        console.log(`  Email: ${usuario.rows[0].email}`);
        console.log(`  Password en BD: ${usuario.rows[0].password ? 'Sí (hasheada)' : 'NULL (falta actualizar)'}\n`);

        // 2. Hashear la nueva contraseña
        const password = 'nQ5w100x';
        console.log(`Hasheando contraseña: ${password}`);
        const hashedPassword = await new Promise((resolve, reject) => {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) reject(err);
                else resolve(hash);
            });
        });

        console.log(`Hash generado: ${hashedPassword.substring(0, 20)}...\n`);

        // 3. Actualizar la contraseña en la BD
        const result = await pool.query(
            'UPDATE usuario SET password = $1 WHERE email = $2',
            [hashedPassword, 'julenescles@gmail.com']
        );

        console.log(`✅ Contraseña actualizada (${result.rowCount} fila(s) afectada(s))\n`);

        // 4. Verificar que se guardó correctamente
        console.log('Verificando contraseña...');
        const updated = await pool.query(
            'SELECT password FROM usuario WHERE email = $1',
            ['julenescles@gmail.com']
        );

        if (updated.rows.length > 0) {
            const isMatch = await new Promise((resolve, reject) => {
                bcrypt.compare(password, updated.rows[0].password, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });

            if (isMatch) {
                console.log('✅ La contraseña coincide correctamente\n');
                console.log('El usuario ya puede iniciar sesión normalmente.');
            } else {
                console.log('❌ La contraseña no coincide');
            }
        }

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
