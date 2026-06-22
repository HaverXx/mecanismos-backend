const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixHabitacionColumns() {
    try {
        console.log("Iniciando migración para corregir columnas idHabitacion...");

        // 1. Agregar columna temporal idHabitacion_new como INTEGER
        console.log("Creando columna temporal idHabitacion_new en mecanismos...");
        await pool.query(`
            ALTER TABLE mecanismos
            ADD COLUMN idHabitacion_new INTEGER REFERENCES habitacion(idHabitacion) ON DELETE SET NULL
        `);

        // 2. Copiar datos convertidos (intentar convertir a int, o NULL si no es posible)
        console.log("Copiando datos convertidos a mecanismos...");
        await pool.query(`
            UPDATE mecanismos
            SET idHabitacion_new = CASE
                WHEN idHabitacion ~ '^[0-9]+$' THEN CAST(idHabitacion AS INTEGER)
                ELSE NULL
            END
        `);

        // 3. Eliminar la columna vieja
        console.log("Eliminando columna idHabitacion antigua en mecanismos...");
        await pool.query(`
            ALTER TABLE mecanismos
            DROP COLUMN idHabitacion
        `);

        // 4. Renombrar la nueva columna
        console.log("Renombrando columna idHabitacion_new a idHabitacion en mecanismos...");
        await pool.query(`
            ALTER TABLE mecanismos
            RENAME COLUMN idHabitacion_new TO idHabitacion
        `);

        // Repetir para presupuesto_mecanismo
        console.log("Creando columna temporal idHabitacion_new en presupuesto_mecanismo...");
        await pool.query(`
            ALTER TABLE presupuesto_mecanismo
            ADD COLUMN idHabitacion_new INTEGER REFERENCES habitacion(idHabitacion) ON DELETE SET NULL
        `);

        console.log("Copiando datos convertidos a presupuesto_mecanismo...");
        await pool.query(`
            UPDATE presupuesto_mecanismo
            SET idHabitacion_new = CASE
                WHEN idHabitacion ~ '^[0-9]+$' THEN CAST(idHabitacion AS INTEGER)
                ELSE NULL
            END
        `);

        console.log("Eliminando columna idHabitacion antigua en presupuesto_mecanismo...");
        await pool.query(`
            ALTER TABLE presupuesto_mecanismo
            DROP COLUMN idHabitacion
        `);

        console.log("Renombrando columna idHabitacion_new a idHabitacion en presupuesto_mecanismo...");
        await pool.query(`
            ALTER TABLE presupuesto_mecanismo
            RENAME COLUMN idHabitacion_new TO idHabitacion
        `);

        console.log("✅ Migración completada exitosamente");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error durante la migración:", error);
        process.exit(1);
    } finally {
        pool.end();
    }
}

fixHabitacionColumns();
