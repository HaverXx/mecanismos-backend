const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixHabitacionTable() {
    try {
        console.log("\n🔧 RECONSTRUYENDO TABLA HABITACION\n");

        // 1. Backup de datos
        console.log("1. Respaldando datos de habitaciones...");
        const backup = await pool.query(`
            SELECT nombre, idvivienda FROM habitacion ORDER BY nombre
        `);
        console.log("Datos respaldados:", backup.rows);

        // 2. Eliminar referencias en otras tablas
        console.log("\n2. Eliminando referencias en mecanismos y presupuestos...");
        await pool.query(`UPDATE mecanismos SET idhabitacion = NULL`);
        await pool.query(`UPDATE presupuesto_mecanismo SET idhabitacion = NULL`);
        console.log("✅ Referencias eliminadas");

        // 3. Eliminar tabla antigua
        console.log("\n3. Eliminando tabla habitacion antigua...");
        await pool.query(`DROP TABLE IF EXISTS habitacion CASCADE`);
        console.log("✅ Tabla eliminada");

        // 4. Crear tabla nueva con SERIAL correctamente
        console.log("\n4. Creando tabla habitacion nueva...");
        await pool.query(`
            CREATE TABLE habitacion (
                idhabitacion SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                idvivienda INTEGER NOT NULL REFERENCES vivienda(idvivienda) ON DELETE CASCADE
            )
        `);
        console.log("✅ Tabla creada");

        // 5. Restaurar datos
        console.log("\n5. Restaurando datos...");
        for (const row of backup.rows) {
            await pool.query(
                `INSERT INTO habitacion (nombre, idvivienda) VALUES ($1, $2)`,
                [row.nombre, row.idvivienda]
            );
        }
        console.log(`✅ ${backup.rows.length} habitaciones restauradas`);

        // 6. Verificar resultado
        console.log("\n6. Verificando resultado final...");
        const final = await pool.query(`
            SELECT idhabitacion, nombre, idvivienda FROM habitacion ORDER BY idhabitacion
        `);
        console.table(final.rows);

        console.log("\n✅ TABLA RECONSTRUIDA EXITOSAMENTE\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error(error);
        process.exit(1);
    } finally {
        pool.end();
    }
}

fixHabitacionTable();
