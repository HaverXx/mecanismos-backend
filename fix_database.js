const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixDatabase() {
    try {
        console.log("Verificando estructura de base de datos...");

        // Verificar tipo de dato de idHabitacion en mecanismos
        const mecanismosCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'mecanismos' AND column_name = 'idhabitacion'
        `);

        console.log("Tipo de idHabitacion en mecanismos:", mecanismosCheck.rows[0]?.data_type || "NO ENCONTRADO");

        // Si la columna es varchar, necesitamos migrarla
        if (mecanismosCheck.rows[0]?.data_type === 'character varying') {
            console.log("Iniciando migración de idHabitacion a INTEGER...");

            // Paso 1: Crear columna temporal en mecanismos
            try {
                await pool.query(`
                    ALTER TABLE mecanismos
                    ADD COLUMN idhabitacion_new INTEGER REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
                `);
                console.log("✅ Columna temporal creada en mecanismos");
            } catch (e) {
                if (e.message.includes('already exists')) {
                    console.log("⚠️  Columna temporal ya existe, limpiando...");
                    await pool.query(`ALTER TABLE mecanismos DROP COLUMN idhabitacion_new`);
                    await pool.query(`
                        ALTER TABLE mecanismos
                        ADD COLUMN idhabitacion_new INTEGER REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
                    `);
                } else throw e;
            }

            // Paso 2: Copiar datos convertidos
            await pool.query(`
                UPDATE mecanismos
                SET idhabitacion_new = CASE
                    WHEN idhabitacion ~ '^[0-9]+$' THEN CAST(idhabitacion AS INTEGER)
                    ELSE NULL
                END
            `);
            console.log("✅ Datos copiados a columna temporal");

            // Paso 3: Eliminar restricciones de columna vieja
            try {
                await pool.query(`
                    ALTER TABLE mecanismos
                    DROP CONSTRAINT mecanismos_idhabitacion_fkey
                `);
                console.log("✅ Restricción antigua eliminada");
            } catch (e) {
                console.log("⚠️  Restricción ya no existía");
            }

            // Paso 4: Eliminar columna vieja
            await pool.query(`
                ALTER TABLE mecanismos
                DROP COLUMN idhabitacion
            `);
            console.log("✅ Columna antigua eliminada");

            // Paso 5: Renombrar columna nueva
            await pool.query(`
                ALTER TABLE mecanismos
                RENAME COLUMN idhabitacion_new TO idhabitacion
            `);
            console.log("✅ Columna nueva renombrada");
        }

        // Repetir para presupuesto_mecanismo
        const presupuestoCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'presupuesto_mecanismo' AND column_name = 'idhabitacion'
        `);

        console.log("Tipo de idHabitacion en presupuesto_mecanismo:", presupuestoCheck.rows[0]?.data_type || "NO ENCONTRADO");

        if (presupuestoCheck.rows[0]?.data_type === 'character varying') {
            console.log("Migrando presupuesto_mecanismo...");

            try {
                await pool.query(`
                    ALTER TABLE presupuesto_mecanismo
                    ADD COLUMN idhabitacion_new INTEGER REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
                `);
            } catch (e) {
                if (e.message.includes('already exists')) {
                    await pool.query(`ALTER TABLE presupuesto_mecanismo DROP COLUMN idhabitacion_new`);
                    await pool.query(`
                        ALTER TABLE presupuesto_mecanismo
                        ADD COLUMN idhabitacion_new INTEGER REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
                    `);
                } else throw e;
            }

            await pool.query(`
                UPDATE presupuesto_mecanismo
                SET idhabitacion_new = CASE
                    WHEN idhabitacion ~ '^[0-9]+$' THEN CAST(idhabitacion AS INTEGER)
                    ELSE NULL
                END
            `);

            try {
                await pool.query(`
                    ALTER TABLE presupuesto_mecanismo
                    DROP CONSTRAINT presupuesto_mecanismo_idhabitacion_fkey
                `);
            } catch (e) {
                console.log("⚠️  Restricción presupuesto ya no existía");
            }

            await pool.query(`
                ALTER TABLE presupuesto_mecanismo
                DROP COLUMN idhabitacion
            `);

            await pool.query(`
                ALTER TABLE presupuesto_mecanismo
                RENAME COLUMN idhabitacion_new TO idhabitacion
            `);
            console.log("✅ presupuesto_mecanismo migrada");
        }

        console.log("\n✅ Base de datos actualizada exitosamente");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error durante la migración:", error.message);
        console.error(error);
        process.exit(1);
    } finally {
        pool.end();
    }
}

fixDatabase();
