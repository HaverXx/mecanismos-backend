const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Tabla Tableros
    db.run(`
        CREATE TABLE IF NOT EXISTS tablero (
            idTablero INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            idUsuario INTEGER NOT NULL,
            FOREIGN KEY(idUsuario) REFERENCES usuario(idUsuario)
        )
    `);

    // Tabla Listas
    db.run(`
        CREATE TABLE IF NOT EXISTS lista (
            idLista INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            orden INTEGER NOT NULL DEFAULT 0,
            idTablero INTEGER NOT NULL,
            FOREIGN KEY(idTablero) REFERENCES tablero(idTablero) ON DELETE CASCADE
        )
    `);

    // Tabla Tareas
    db.run(`
        CREATE TABLE IF NOT EXISTS tarea (
            idTarea INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            descripcion TEXT,
            orden INTEGER NOT NULL DEFAULT 0,
            idLista INTEGER NOT NULL,
            FOREIGN KEY(idLista) REFERENCES lista(idLista) ON DELETE CASCADE
        )
    `);

    console.log("Tablas de planificador creadas correctamente.");
});

db.close();
