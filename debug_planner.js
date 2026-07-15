const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const debug = async () => {
    try {
        const tableros = await pool.query("SELECT * FROM tablero");
        console.log("TABLEROS:", tableros.rows);
        const listas = await pool.query("SELECT * FROM lista");
        console.log("LISTAS:", listas.rows);
        const tareas = await pool.query("SELECT * FROM tarea");
        console.log("TAREAS:", tareas.rows);
    } catch(err) {
        console.error(err);
    } finally {
        pool.end();
    }
};

debug();
