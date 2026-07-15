const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const alterTables = async () => {
    try {
        await pool.query(`ALTER TABLE lista ADD COLUMN IF NOT EXISTS color VARCHAR(50)`);
        await pool.query(`ALTER TABLE tarea ADD COLUMN IF NOT EXISTS color VARCHAR(50)`);
        console.log("Columnas color añadidas exitosamente.");
    } catch (err) {
        console.error("Error al añadir columnas:", err);
    } finally {
        pool.end();
    }
};

alterTables();
