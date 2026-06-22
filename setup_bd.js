const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createHabitacionTable() {
    try {
        console.log("\n🔧 CREANDO TABLA HABITACION\n");

        console.log("1. Creando tabla habitacion...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS habitacion (
                idhabitacion SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                idvivienda INTEGER NOT NULL REFERENCES vivienda(idvivienda) ON DELETE CASCADE
            )
        `);
        console.log("✅ Tabla habitacion creada");

        console.log("\n2. Verificando que mecanismos tiene referencia correcta...");
        // Asegurar que mecanismos tiene idhabitacion como INTEGER
        const mecanismosSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'mecanismos' AND column_name = 'idhabitacion'
        `);
        
        if (mecanismosSchema.rows.length > 0) {
            console.log("Column type:", mecanismosSchema.rows[0].data_type);
            if (mecanismosSchema.rows[0].data_type === 'character varying') {
                console.log("⚠️  idhabitacion en mecanismos es VARCHAR, convertiendo a INTEGER...");
                
                // Crear columna nueva
                await pool.query(`
                    ALTER TABLE mecanismos
                    ADD COLUMN idhabitacion_new INTEGER REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
                `);
                
                // Copiar datos
                await pool.query(`
                    UPDATE mecanismos
                    SET idhabitacion_new = CASE
                        WHEN idhabitacion ~ '^[0-9]+$' THEN CAST(idhabitacion AS INTEGER)
                        ELSE NULL
                    END
                `);
                
                // Eliminar restricción vieja
                try {
                    await pool.query(`
                        ALTER TABLE mecanismos
                        DROP CONSTRAINT mecanismos_idhabitacion_fkey
                    `);
                } catch (e) {
                    console.log("Sin restricción previa");
                }
                
                // Eliminar columna vieja
                await pool.query(`
                    ALTER TABLE mecanismos
                    DROP COLUMN idhabitacion
                `);
                
                // Renombrar nueva
                await pool.query(`
                    ALTER TABLE mecanismos
                    RENAME COLUMN idhabitacion_new TO idhabitacion
                `);
                console.log("✅ mecanismos.idhabitacion convertida a INTEGER");
            }
        }

        console.log("\n3. Haciendo lo mismo para presupuesto_mecanismo...");
        const presupuestoSchema = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'presupuesto_mecanismo' AND column_name = 'idhabitacion'
        `);
        
        if (presupuestoSchema.rows.length > 0 && presupuestoSchema.rows[0].data_type === 'character varying') {
            console.log("Convertiendo presupuesto_mecanismo.idhabitacion...");
            
            await pool.query(`
                ALTER TABLE presupuesto_mecanismo
                ADD COLUMN idhabitacion_new INTEGER REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
            `);
            
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
                console.log("Sin restricción previa");
            }
            
            await pool.query(`
                ALTER TABLE presupuesto_mecanismo
                DROP COLUMN idhabitacion
            `);
            
            await pool.query(`
                ALTER TABLE presupuesto_mecanismo
                RENAME COLUMN idhabitacion_new TO idhabitacion
            `);
            console.log("✅ presupuesto_mecanismo.idhabitacion convertida a INTEGER");
        }

        console.log("\n✅ BASE DE DATOS CONFIGURADA CORRECTAMENTE\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        console.error(error);
        process.exit(1);
    } finally {
        pool.end();
    }
}

createHabitacionTable();
