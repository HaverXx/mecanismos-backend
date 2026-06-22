const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixDatabase() {
    try {
        console.log("\n🔧 VERIFICANDO Y ARREGLANDO ESTRUCTURA DE BD\n");

        // 1. Verificar vivienda
        console.log("1. Verificando tabla vivienda...");
        const viviendaSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'vivienda'
            ORDER BY ordinal_position
        `);
        console.table(viviendaSchema.rows);

        // 2. Verificar constraints en vivienda
        console.log("\n2. Verificando constraints en vivienda...");
        const constraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'vivienda'
        `);
        console.table(constraints.rows);

        // 3. Si idvivienda no es PRIMARY KEY, arreglarlo
        const hasPK = constraints.rows.some(c => c.constraint_type === 'PRIMARY KEY');
        if (!hasPK) {
            console.log("\n⚠️  vivienda no tiene PRIMARY KEY, creando...");
            await pool.query(`ALTER TABLE vivienda ADD PRIMARY KEY (idvivienda)`);
            console.log("✅ PRIMARY KEY creado");
        } else {
            console.log("✅ PRIMARY KEY ya existe");
        }

        // 4. Ahora reconstruir habitacion
        console.log("\n3. Respaldando datos de habitaciones...");
        const backup = await pool.query(`
            SELECT nombre, idvivienda FROM habitacion ORDER BY nombre
        `);
        console.log("Datos respaldados:", backup.rows.length, "habitaciones");

        console.log("\n4. Eliminando referencias en mecanismos...");
        await pool.query(`UPDATE mecanismos SET idhabitacion = NULL`);
        await pool.query(`UPDATE presupuesto_mecanismo SET idhabitacion = NULL`);

        console.log("\n5. Eliminando tabla habitacion...");
        await pool.query(`DROP TABLE IF EXISTS habitacion CASCADE`);

        console.log("\n6. Creando tabla habitacion nueva...");
        await pool.query(`
            CREATE TABLE habitacion (
                idhabitacion SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                idvivienda INTEGER NOT NULL REFERENCES vivienda(idvivienda) ON DELETE CASCADE
            )
        `);

        console.log("\n7. Restaurando datos...");
        for (const row of backup.rows) {
            await pool.query(
                `INSERT INTO habitacion (nombre, idvivienda) VALUES ($1, $2)`,
                [row.nombre, row.idvivienda]
            );
        }
        console.log(`✅ ${backup.rows.length} habitaciones restauradas`);

        console.log("\n8. Verificando resultado final...");
        const final = await pool.query(`
            SELECT idhabitacion, nombre, idvivienda FROM habitacion ORDER BY idhabitacion
        `);
        console.table(final.rows);

        console.log("\n✅ BASE DE DATOS RECONSTRUIDA EXITOSAMENTE\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error(error);
        process.exit(1);
    } finally {
        pool.end();
    }
}

fixDatabase();
