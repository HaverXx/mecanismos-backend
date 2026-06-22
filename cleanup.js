const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    try {
        console.log("Limpiando columnas temporales...");
        await pool.query("ALTER TABLE mecanismos DROP COLUMN IF EXISTS idhabitacion_temp");
        await pool.query("ALTER TABLE presupuesto_mecanismo DROP COLUMN IF EXISTS idhabitacion_temp");
        console.log("✅ Limpiado");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(0);
    } finally {
        pool.end();
    }
}

cleanup();
