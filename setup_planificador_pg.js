const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const init = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tablero (
                idTablero SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                idUsuario INTEGER NOT NULL REFERENCES usuario(idUsuario) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS lista (
                idLista SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                orden INTEGER NOT NULL DEFAULT 0,
                idTablero INTEGER NOT NULL REFERENCES tablero(idTablero) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS tarea (
                idTarea SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                descripcion TEXT,
                orden INTEGER NOT NULL DEFAULT 0,
                idLista INTEGER NOT NULL REFERENCES lista(idLista) ON DELETE CASCADE
            );
        `);
        console.log("Tablas del planificador creadas en PostgreSQL");
    } catch (err) {
        console.error("Error creando tablas:", err);
    } finally {
        pool.end();
    }
};

init();
