const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Agregando PRIMARY KEY a invitacion...\n');

        // Agregar PRIMARY KEY ahora que no hay NULLs
        console.log('Intentando agregar PRIMARY KEY...');
        try {
            await pool.query(`
                ALTER TABLE invitacion
                ADD PRIMARY KEY (idinvitacion)
            `);
            console.log('✅ PRIMARY KEY agregado exitosamente\n');
        } catch (err) {
            console.log(`⚠️ Error: ${err.message}\n`);
        }

        // Verificar estado final
        console.log('Estado final:');
        console.log('\nInvitaciones:');
        const inv = await pool.query(`SELECT * FROM invitacion`);
        inv.rows.forEach(i => {
            console.log(`  - ID ${i.idinvitacion}: Para grupo ${i.idgrupo}, destinatario: ${i.emaildestinatario}, estado: ${i.estado}`);
        });

        console.log('\nConstraints de invitacion:');
        const constraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'invitacion'
        `);
        constraints.rows.forEach(c => {
            console.log(`  - ${c.constraint_name} (${c.constraint_type})`);
        });

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
