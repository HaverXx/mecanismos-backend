const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        console.log("\n✅ VERIFICACIÓN FINAL DE BD\n");

        console.log("1. Tabla habitacion:");
        const hab = await pool.query(`SELECT * FROM habitacion LIMIT 5`);
        console.table(hab.rows);

        console.log("\n2. Tabla mecanismos:");
        const mec = await pool.query(`SELECT idmecanismo, nombre, idhabitacion FROM mecanismos LIMIT 5`);
        console.table(mec.rows);

        console.log("\n3. Estructura mecanismos.idhabitacion:");
        const col = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'mecanismos' AND column_name = 'idhabitacion'
        `);
        console.table(col.rows);

        console.log("\n✅ Verificación completada\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

verify();
