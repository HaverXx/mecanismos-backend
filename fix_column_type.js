const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixColumnType() {
    try {
        console.log("\n🔧 CORRIGIENDO TIPOS DE COLUMNAS\n");

        // 1. Agregar columna temporal en mecanismos
        console.log("1️⃣ Agregando columna temporal idhabitacion_temp en mecanismos...");
        await pool.query(`
            ALTER TABLE mecanismos 
            ADD COLUMN idhabitacion_temp INTEGER
        `).catch(e => {
            if (e.message.includes("already exists")) {
                console.log("   ⚠️  Columna temporal ya existe, continuando...");
            } else {
                throw e;
            }
        });

        // 2. Migrar datos de texto a INTEGER en mecanismos
        console.log("2️⃣ Migrando datos de idhabitacion a idhabitacion_temp...");
        await pool.query(`
            UPDATE mecanismos 
            SET idhabitacion_temp = CASE 
                WHEN idhabitacion IS NULL THEN NULL
                WHEN TRIM(idhabitacion) = '' THEN NULL
                WHEN idhabitacion ~ '^[0-9]+$' THEN CAST(idhabitacion AS INTEGER)
                ELSE NULL
            END
        `);
        console.log("   ✅ Datos migrados");

        // 3. Borrar la columna antigua y renombrar la nueva en mecanismos
        console.log("3️⃣ Reemplazando columna en mecanismos...");
        await pool.query(`
            ALTER TABLE mecanismos 
            DROP COLUMN idhabitacion
        `);
        await pool.query(`
            ALTER TABLE mecanismos 
            RENAME COLUMN idhabitacion_temp TO idhabitacion
        `);
        console.log("   ✅ Columna reemplazada");

        // 4. Agregar constraint de FK en mecanismos
        console.log("4️⃣ Agregando foreign key en mecanismos.idhabitacion...");
        await pool.query(`
            ALTER TABLE mecanismos 
            ADD CONSTRAINT fk_mecanismos_habitacion 
            FOREIGN KEY (idhabitacion) REFERENCES habitacion(idhabitacion) 
            ON DELETE SET NULL
        `).catch(e => {
            if (e.message.includes("already exists")) {
                console.log("   ⚠️  FK ya existe");
            } else {
                throw e;
            }
        });

        // 5. Lo mismo para presupuesto_mecanismo
        console.log("\n5️⃣ Verificando presupuesto_mecanismo...");
        const presupCol = await pool.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'presupuesto_mecanismo' AND column_name = 'idhabitacion'
        `);
        
        if (presupCol.rows.length > 0 && presupCol.rows[0].data_type === 'text') {
            console.log("6️⃣ Corrigiendo presupuesto_mecanismo...");
            
            await pool.query(`
                ALTER TABLE presupuesto_mecanismo 
                ADD COLUMN idhabitacion_temp INTEGER
            `).catch(e => {
                if (!e.message.includes("already exists")) throw e;
            });

            await pool.query(`
                UPDATE presupuesto_mecanismo 
                SET idhabitacion_temp = CASE 
                    WHEN idhabitacion IS NULL THEN NULL
                    WHEN TRIM(idhabitacion) = '' THEN NULL
                    WHEN idhabitacion ~ '^[0-9]+$' THEN CAST(idhabitacion AS INTEGER)
                    ELSE NULL
                END
            `);

            await pool.query(`
                ALTER TABLE presupuesto_mecanismo 
                DROP COLUMN idhabitacion
            `);
            await pool.query(`
                ALTER TABLE presupuesto_mecanismo 
                RENAME COLUMN idhabitacion_temp TO idhabitacion
            `);

            await pool.query(`
                ALTER TABLE presupuesto_mecanismo 
                ADD CONSTRAINT fk_presupuesto_mec_habitacion 
                FOREIGN KEY (idhabitacion) REFERENCES habitacion(idhabitacion) 
                ON DELETE SET NULL
            `).catch(e => {
                if (!e.message.includes("already exists")) throw e;
            });

            console.log("   ✅ presupuesto_mecanismo corregida");
        }

        console.log("\n✅ TODAS LAS COLUMNAS CORREGIDAS\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

fixColumnType();
