const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkHabitaciones() {
    try {
        console.log("\n🔍 VERIFICANDO HABITACIONES EN BD\n");

        // Verificar estructura
        console.log("1. Estructura de tabla habitacion:");
        const schema = await pool.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'habitacion'
            ORDER BY ordinal_position
        `);
        console.table(schema.rows);

        // Verificar datos
        console.log("\n2. Todas las habitaciones en BD:");
        const allHabs = await pool.query(`
            SELECT idhabitacion, nombre, idvivienda
            FROM habitacion
        `);
        console.table(allHabs.rows);

        // Verificar si hay duplicados
        console.log("\n3. Búsqueda de IDs duplicados:");
        const duplicates = await pool.query(`
            SELECT idhabitacion, COUNT(*) as count
            FROM habitacion
            GROUP BY idhabitacion
            HAVING COUNT(*) > 1
        `);
        if (duplicates.rows.length > 0) {
            console.log("⚠️  IDs DUPLICADOS ENCONTRADOS:");
            console.table(duplicates.rows);
        } else {
            console.log("✅ No hay IDs duplicados");
        }

        // Verificar ID secuencia
        console.log("\n4. Estado de secuencia:");
        const sequence = await pool.query(`
            SELECT last_value FROM habitacion_idhabitacion_seq
        `);
        console.log("Último ID usado:", sequence.rows[0]?.last_value);

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

checkHabitaciones();
