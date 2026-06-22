const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixAll() {
    try {
        console.log("\n🔧 CORRIGIENDO ESTADO DE BD\n");

        // Primero limpiar columnas temporales si existen
        console.log("1️⃣ Limpiando columnas temporales...");
        await pool.query("ALTER TABLE mecanismos DROP COLUMN IF EXISTS idhabitacion_temp").catch(e => console.log("   ℹ️  " + e.message.split('\n')[0]));
        await pool.query("ALTER TABLE presupuesto_mecanismo DROP COLUMN IF EXISTS idhabitacion_temp").catch(e => console.log("   ℹ️  " + e.message.split('\n')[0]));

        // Verificar tipos actuales
        console.log("\n2️⃣ Verificando tipos actuales...");
        const mecCol = await pool.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'mecanismos' AND column_name = 'idhabitacion'
        `);
        console.log(`   mecanismos.idhabitacion: ${mecCol.rows[0]?.data_type || 'NO EXISTE'}`);

        const presCol = await pool.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'presupuesto_mecanismo' AND column_name = 'idhabitacion'
        `);
        console.log(`   presupuesto_mecanismo.idhabitacion: ${presCol.rows[0]?.data_type || 'NO EXISTE'}`);

        // Corregir mecanismos si es text
        if (mecCol.rows[0]?.data_type === 'text') {
            console.log("\n3️⃣ Corrigiendo mecanismos.idhabitacion (text → INTEGER)...");
            await pool.query(`
                ALTER TABLE mecanismos 
                ADD COLUMN idhabitacion_new INTEGER
            `);
            await pool.query(`
                UPDATE mecanismos 
                SET idhabitacion_new = CASE 
                    WHEN idhabitacion IS NULL THEN NULL
                    WHEN TRIM(idhabitacion) = '' THEN NULL
                    WHEN idhabitacion ~ '^[0-9]+$' THEN CAST(TRIM(idhabitacion) AS INTEGER)
                    ELSE NULL
                END
            `);
            await pool.query(`ALTER TABLE mecanismos DROP COLUMN idhabitacion`);
            await pool.query(`ALTER TABLE mecanismos RENAME COLUMN idhabitacion_new TO idhabitacion`);
            console.log("   ✅ Hecho");
        } else {
            console.log("   ✅ mecanismos.idhabitacion ya es INTEGER");
        }

        // Corregir presupuesto_mecanismo si es text
        if (presCol.rows[0]?.data_type === 'text') {
            console.log("\n4️⃣ Corrigiendo presupuesto_mecanismo.idhabitacion (text → INTEGER)...");
            await pool.query(`
                ALTER TABLE presupuesto_mecanismo 
                ADD COLUMN idhabitacion_new INTEGER
            `);
            await pool.query(`
                UPDATE presupuesto_mecanismo 
                SET idhabitacion_new = CASE 
                    WHEN idhabitacion IS NULL THEN NULL
                    WHEN TRIM(idhabitacion) = '' THEN NULL
                    WHEN idhabitacion ~ '^[0-9]+$' THEN CAST(TRIM(idhabitacion) AS INTEGER)
                    ELSE NULL
                END
            `);
            await pool.query(`ALTER TABLE presupuesto_mecanismo DROP COLUMN idhabitacion`);
            await pool.query(`ALTER TABLE presupuesto_mecanismo RENAME COLUMN idhabitacion_new TO idhabitacion`);
            console.log("   ✅ Hecho");
        } else {
            console.log("   ✅ presupuesto_mecanismo.idhabitacion ya es INTEGER");
        }

        // Agregar FKs si no existen
        console.log("\n5️⃣ Agregando foreign keys...");
        await pool.query(`
            ALTER TABLE mecanismos 
            ADD CONSTRAINT fk_mecanismos_habitacion 
            FOREIGN KEY (idhabitacion) REFERENCES habitacion(idhabitacion) 
            ON DELETE SET NULL
        `).catch(e => {
            if (e.message.includes("already exists")) {
                console.log("   ℹ️  FK mecanismos ya existe");
            } else {
                throw e;
            }
        });

        await pool.query(`
            ALTER TABLE presupuesto_mecanismo 
            ADD CONSTRAINT fk_presupuesto_mec_habitacion 
            FOREIGN KEY (idhabitacion) REFERENCES habitacion(idhabitacion) 
            ON DELETE SET NULL
        `).catch(e => {
            if (e.message.includes("already exists")) {
                console.log("   ℹ️  FK presupuesto_mecanismo ya existe");
            } else {
                throw e;
            }
        });

        console.log("\n✅ BASE DE DATOS CORREGIDA\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

fixAll();
