const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Reparando tabla invitacion...\n');

        // 1. Crear secuencia para idinvitacion
        console.log('1. Creando secuencia para idinvitacion...');
        try {
            await pool.query(`CREATE SEQUENCE invitacion_idinvitacion_seq START 1`);
            console.log('   ✅ Secuencia creada');
        } catch (err) {
            console.log('   ℹ️ Secuencia ya existe');
        }

        // 2. Actualizar columna idinvitacion
        console.log('\n2. Configurando idinvitacion con secuencia...');
        try {
            await pool.query(`
                ALTER TABLE invitacion
                ALTER COLUMN idinvitacion SET DEFAULT nextval('invitacion_idinvitacion_seq'::regclass)
            `);
            console.log('   ✅ Default configurado');
        } catch (err) {
            console.log(`   ℹ️ Ya está configurado: ${err.message}`);
        }

        // 3. Agregar PRIMARY KEY
        console.log('\n3. Agregando PRIMARY KEY a invitacion...');
        try {
            await pool.query(`
                ALTER TABLE invitacion
                ADD PRIMARY KEY (idinvitacion)
            `);
            console.log('   ✅ PRIMARY KEY agregado');
        } catch (err) {
            console.log(`   ℹ️ Ya existe: ${err.message}`);
        }

        // 4. Limpiar invitaciones con idinvitacion NULL
        console.log('\n4. Limpiando invitaciones con ID NULL...');
        let result = await pool.query(`
            DELETE FROM invitacion WHERE idinvitacion IS NULL
        `);
        console.log(`   ✅ Eliminadas ${result.rowCount} invitaciones con ID NULL`);

        // 5. Crear una invitación de prueba correcta
        console.log('\n5. Creando invitación de prueba...');
        result = await pool.query(`
            INSERT INTO invitacion (idgrupo, idremitente, emaildestinatario, estado)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [11, 1, 'prueba@gmail.com', 'PENDIENTE']);
        console.log('   ✅ Invitación creada:');
        console.log(`     ${JSON.stringify(result.rows[0])}`);

        // 6. Verificación final
        console.log('\n6. Invitaciones actuales:');
        const inv = await pool.query(`SELECT * FROM invitacion`);
        if (inv.rows.length === 0) {
            console.log('   (Ninguna)');
        } else {
            inv.rows.forEach(i => {
                console.log(`   ID ${i.idinvitacion}: De usuario ${i.idremitente} a ${i.emaildestinatario} para grupo ${i.idgrupo} (${i.estado})`);
            });
        }

        console.log('\n✅ Tabla invitacion reparada!');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
