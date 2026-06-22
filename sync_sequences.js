const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function syncSequence() {
    try {
        console.log("\n🔄 SINCRONIZANDO SECUENCIAS\n");

        // 1. Obtener máximo ID de mecanismos
        console.log("1️⃣ Encontrando máximo ID en mecanismos...");
        const mecResult = await pool.query("SELECT COALESCE(MAX(idmecanismo), 0) as max_id FROM mecanismos");
        const maxMecId = mecResult.rows[0].max_id;
        console.log(`   Max ID: ${maxMecId}`);

        // 2. Establecer secuencia a maxId + 1
        console.log(`\n2️⃣ Ajustando secuencia mecanismos_idmecanismo_seq a ${maxMecId + 1}...`);
        await pool.query(`SELECT setval('mecanismos_idmecanismo_seq', ${maxMecId})`);
        console.log("   ✅ Hecho");

        // 3. Lo mismo para presupuesto si existe
        console.log("\n3️⃣ Buscando secuencia de presupuesto...");
        const tableResult = await pool.query(`
            SELECT column_default 
            FROM information_schema.columns 
            WHERE table_name = 'presupuesto' AND column_name = 'idpresupuesto'
        `);
        
        if (tableResult.rows[0]?.column_default?.includes('seq')) {
            const presResult = await pool.query("SELECT COALESCE(MAX(idpresupuesto), 0) as max_id FROM presupuesto");
            const maxPresId = presResult.rows[0].max_id;
            console.log(`   Max presupuesto ID: ${maxPresId}`);
            
            const seqName = tableResult.rows[0].column_default.match(/(\w+_seq)/)?.[1];
            if (seqName) {
                console.log(`   Ajustando ${seqName} a ${maxPresId + 1}...`);
                await pool.query(`SELECT setval('${seqName}', ${maxPresId})`);
                console.log("   ✅ Hecho");
            }
        }

        // 4. Lo mismo para habitacion
        console.log("\n4️⃣ Buscando secuencia de habitacion...");
        const habTableResult = await pool.query(`
            SELECT column_default 
            FROM information_schema.columns 
            WHERE table_name = 'habitacion' AND column_name = 'idhabitacion'
        `);
        
        if (habTableResult.rows[0]?.column_default?.includes('seq')) {
            const habResult = await pool.query("SELECT COALESCE(MAX(idhabitacion), 0) as max_id FROM habitacion");
            const maxHabId = habResult.rows[0].max_id;
            console.log(`   Max habitacion ID: ${maxHabId}`);
            
            const seqName = habTableResult.rows[0].column_default.match(/(\w+_seq)/)?.[1];
            if (seqName) {
                console.log(`   Ajustando ${seqName} a ${maxHabId + 1}...`);
                await pool.query(`SELECT setval('${seqName}', ${maxHabId})`);
                console.log("   ✅ Hecho");
            }
        }

        console.log("\n✅ SECUENCIAS SINCRONIZADAS\n");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    } finally {
        pool.end();
    }
}

syncSequence();
