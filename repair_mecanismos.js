const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixMecanismos() {
    try {
        console.log("\n🔧 REPARANDO TABLA MECANISMOS\n");

        // 1. Crear secuencia
        console.log("1️⃣ Creando secuencia para idmecanismo...");
        await pool.query("DROP SEQUENCE IF EXISTS mecanismos_idmecanismo_seq CASCADE");
        await pool.query("CREATE SEQUENCE mecanismos_idmecanismo_seq START 1");
        console.log("   ✅ Hecho");

        // 2. Crear tabla temporal con estructura correcta
        console.log("\n2️⃣ Creando tabla temporal...");
        await pool.query(`
            CREATE TABLE mecanismos_temp (
                idmecanismo INTEGER PRIMARY KEY DEFAULT nextval('mecanismos_idmecanismo_seq'),
                nombre VARCHAR(255),
                descripcion TEXT,
                preciounitario REAL NOT NULL,
                cantidad INTEGER NOT NULL,
                idvivienda INTEGER REFERENCES vivienda(idvivienda) ON DELETE CASCADE,
                foto BYTEA,
                idhabitacion INTEGER REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
            )
        `);
        console.log("   ✅ Creada");

        // 3. Copiar datos (excepto null idmecanismo)
        console.log("\n3️⃣ Migrando datos...");
        await pool.query(`
            INSERT INTO mecanismos_temp (idmecanismo, nombre, descripcion, preciounitario, cantidad, idvivienda, foto, idhabitacion)
            SELECT idmecanismo, nombre, descripcion, preciounitario, cantidad, idvivienda, foto, idhabitacion
            FROM mecanismos
            WHERE idmecanismo IS NOT NULL
        `);
        console.log("   ✅ Datos migrados");

        // 4. Eliminar tabla vieja y renombrar
        console.log("\n4️⃣ Reemplazando tabla...");
        await pool.query("DROP TABLE mecanismos");
        await pool.query("ALTER TABLE mecanismos_temp RENAME TO mecanismos");
        console.log("   ✅ Tabla reemplazada");

        // 5. Recrear índices y constraints
        console.log("\n5️⃣ Agregando constraints...");
        await pool.query(`
            ALTER TABLE mecanismos
            ADD CONSTRAINT fk_mecanismos_vivienda
            FOREIGN KEY (idvivienda) REFERENCES vivienda(idvivienda) ON DELETE CASCADE
        `).catch(e => console.log("   ℹ️  " + e.message.split('\n')[0]));

        await pool.query(`
            ALTER TABLE mecanismos
            ADD CONSTRAINT fk_mecanismos_habitacion
            FOREIGN KEY (idhabitacion) REFERENCES habitacion(idhabitacion) ON DELETE SET NULL
        `).catch(e => console.log("   ℹ️  " + e.message.split('\n')[0]));

        console.log("   ✅ Constraints agregados");

        console.log("\n✅ TABLA MECANISMOS REPARADA\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

fixMecanismos();
