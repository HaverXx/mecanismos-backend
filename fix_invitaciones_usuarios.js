const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Verificando usuarios y arreglando invitaciones...\n');

        // 1. Ver usuarios actuales
        console.log('1. Usuarios actuales:');
        const users = await pool.query(`
            SELECT idusuario, email, fullname FROM usuario ORDER BY idusuario
        `);
        users.rows.forEach(u => {
            console.log(`   ${u.idusuario}: ${u.fullname} (${u.email})`);
        });

        // 2. Ver invitaciones
        console.log('\n2. Invitaciones actuales:');
        const inv = await pool.query(`SELECT * FROM invitacion`);
        if (inv.rows.length === 0) {
            console.log('   (Ninguna)');
        } else {
            inv.rows.forEach(i => {
                console.log(`   ID ${i.idinvitacion}: De ${i.idremitente} a ${i.emaildestinatario} para grupo ${i.idgrupo}`);
            });
        }

        // 3. Limpiar invitaciones para usuarios que no existen
        console.log('\n3. Limpiando invitaciones inválidas...');
        const del = await pool.query(`
            DELETE FROM invitacion
            WHERE emaildestinatario NOT IN (SELECT email FROM usuario)
        `);
        console.log(`   ✅ Eliminadas ${del.rowCount} invitaciones para usuarios inexistentes`);

        // 4. Crear invitaciones válidas de ejemplo
        console.log('\n4. Creando invitaciones de ejemplo...');
        
        // Julen invita a Juanete al grupo 11
        await pool.query(`
            DELETE FROM invitacion WHERE idgrupo = 11
        `);

        const result1 = await pool.query(`
            INSERT INTO invitacion (idgrupo, idremitente, emaildestinatario, estado)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [11, 1, 'juanete@gmail.com', 'PENDIENTE']);
        console.log(`   ✅ Invitación creada: Julen invita a Juanete`);
        console.log(`      ${JSON.stringify(result1.rows[0])}`);

        // 5. Verificación final
        console.log('\n5. Invitaciones finales:');
        const finalInv = await pool.query(`SELECT * FROM invitacion`);
        finalInv.rows.forEach(i => {
            const remitente = users.rows.find(u => u.idusuario === i.idremitente);
            console.log(`   ID ${i.idinvitacion}: ${remitente.fullname} invita a ${i.emaildestinatario} (${i.estado})`);
        });

        console.log('\n✅ Invitaciones reparadas!');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
