const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-mecanismos-key";

// We'll generate a fake token for a dummy user or just use an existing user if we can.
// Let's first find a user in the DB.
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const testApi = async () => {
    try {
        const userRes = await pool.query("SELECT * FROM usuario LIMIT 1");
        if (userRes.rows.length === 0) {
            console.log("No users found to test API");
            return;
        }
        const user = userRes.rows[0];
        const token = jwt.sign({ id: user.idusuario, email: user.email }, JWT_SECRET, { expiresIn: '1y' });
        
        console.log("Testing POST /tableros with user ID:", user.idusuario);
        
        // 1. Create Tablero
        const resTablero = await fetch("http://localhost:3000/tableros", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ nombre: "Tablero Test" })
        });
        const tablero = await resTablero.json();
        console.log("Tablero Created:", tablero);
        
        if (!tablero.idTablero) {
            console.error("Failed to create tablero, response:", tablero);
            return;
        }

        // 2. Create Lista
        const resLista = await fetch("http://localhost:3000/listas", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ nombre: "Lista Test", idTablero: tablero.idTablero, orden: 0 })
        });
        const lista = await resLista.json();
        console.log("Lista Created:", lista);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
};

testApi();
