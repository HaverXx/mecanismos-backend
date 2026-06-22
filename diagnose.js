const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function diagnoseDatabase() {
    try {
        console.log("\n🔍 DIAGNÓSTICO DE BASE DE DATOS MECANISMOS\n");

        // 1. Verificar esquema de tablas
        console.log("1️⃣  ESQUEMA DE HABITACION:");
        const habitacionSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'habitacion'
            ORDER BY ordinal_position
        `);
        console.table(habitacionSchema.rows);

        console.log("\n2️⃣  ESQUEMA DE MECANISMOS:");
        const mecanismosSchema = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'mecanismos'
            ORDER BY ordinal_position
        `);
        console.table(mecanismosSchema.rows);

        // 2. Verificar datos
        console.log("\n3️⃣  HABITACIONES EN BD:");
        const habitaciones = await pool.query(`
            SELECT idhabitacion, nombre, idvivienda 
            FROM habitacion LIMIT 10
        `);
        console.table(habitaciones.rows);

        // 3. Verificar mecanismos
        console.log("\n4️⃣  MECANISMOS CON HABITACION:");
        const mecanismos = await pool.query(`
            SELECT idmecanismo, nombre, idhabitacion 
            FROM mecanismos 
            WHERE idhabitacion IS NOT NULL 
            LIMIT 10
        `);
        console.table(mecanismos.rows);

        // 4. Verificar restricciones
        console.log("\n5️⃣  RESTRICCIONES FORÁNEAS:");
        const constraints = await pool.query(`
            SELECT constraint_name, table_name, column_name
            FROM information_schema.key_column_usage
            WHERE table_name IN ('mecanismos', 'presupuesto_mecanismo', 'habitacion')
            ORDER BY table_name
        `);
        console.table(constraints.rows);

        console.log("\n✅ Diagnóstico completado\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

diagnoseDatabase();
