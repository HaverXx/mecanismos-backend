const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkStructure() {
    try {
        console.log("\n📋 ESTRUCTURA DE TABLA MECANISMOS\n");

        const result = await pool.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'mecanismos'
            ORDER BY ordinal_position
        `);

        console.table(result.rows);

        console.log("\n🔑 PRIMARY KEYS:\n");
        const pk = await pool.query(`
            SELECT constraint_name, column_name
            FROM information_schema.key_column_usage
            WHERE table_name = 'mecanismos' AND constraint_name LIKE '%pkey%'
        `);
        console.table(pk.rows);

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

checkStructure();
