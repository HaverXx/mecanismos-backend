const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Reemplazar imports y configuración inicial
code = code.replace(
    /const sqlite3 = require\("sqlite3"\)\.verbose\(\);\n/g,
    `const { Pool } = require("pg");\nrequire("dotenv").config();\n`
);

code = code.replace(
    /const db = new sqlite3\.Database\("\.\/database\.sqlite"\);\ndb\.run\("PRAGMA foreign_keys = ON;"\);/g,
    `const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const keyMap = {
    idusuario: "idUsuario",
    fullname: "fullName",
    idgrupo: "idGrupo",
    idowner: "idOwner",
    idremitente: "idRemitente",
    emaildestinatario: "emailDestinatario",
    idvivienda: "idVivienda",
    idduenyo: "idDuenyo",
    idmecanismo: "idMecanismo",
    preciounitario: "precioUnitario",
    idhabitacion: "idHabitacion",
    idpresupuesto: "idPresupuesto",
    clientenombre: "clienteNombre",
    clientedireccion: "clienteDireccion",
    idpresupuestomecanismo: "idPresupuestoMecanismo",
    idpresupuestoanadido: "idPresupuestoAnadido",
    ownername: "ownerName",
    gruponombre: "grupoNombre",
    membercount: "memberCount",
    nombreremitente: "nombreRemitente",
    isowner: "isOwner"
};

function mapKeys(row) {
    if (!row) return row;
    const newRow = {};
    for (const key in row) {
        if (keyMap[key]) {
            newRow[keyMap[key]] = row[key];
        } else {
            newRow[key] = row[key];
        }
    }
    return newRow;
}

function convertQuery(query) {
    let index = 1;
    // Replace ? outside of quotes (simplistic)
    return query.replace(/\\?/g, () => \`$\${index++}\`);
}

const db = {
    run: function (query, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        const isInsert = query.trim().toUpperCase().startsWith('INSERT');
        let pgQuery = convertQuery(query);
        if (isInsert && !pgQuery.toUpperCase().includes("RETURNING")) {
            pgQuery += " RETURNING *";
        }
        pool.query(pgQuery, params || [])
            .then(res => {
                const context = { changes: res.rowCount, lastID: null };
                if (isInsert && res.rows.length > 0) {
                    const row = mapKeys(res.rows[0]);
                    const idCol = Object.keys(row).find(k => k.toLowerCase().startsWith('id'));
                    if (idCol) context.lastID = row[idCol];
                }
                if (callback) callback.call(context, null);
            })
            .catch(err => {
                console.error("DB RUN ERROR:", err, "Query:", pgQuery);
                if (callback) callback(err);
            });
    },
    get: function (query, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        pool.query(convertQuery(query), params || [])
            .then(res => {
                if (callback) callback(null, mapKeys(res.rows[0]));
            })
            .catch(err => {
                console.error("DB GET ERROR:", err, "Query:", convertQuery(query));
                if (callback) callback(err, null);
            });
    },
    all: function (query, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        pool.query(convertQuery(query), params || [])
            .then(res => {
                if (callback) callback(null, res.rows.map(mapKeys));
            })
            .catch(err => {
                console.error("DB ALL ERROR:", err, "Query:", convertQuery(query));
                if (callback) callback(err, null);
            });
    },
    serialize: function(callback) {
        callback();
    }
};`
);

// 2. Reemplazar la creación de tablas (db.serialize)
const serializeStart = code.indexOf('// Asegurar índice único en email');
const authMiddlewareStart = code.indexOf('// Middleware de autenticación JWT');

const initDB = \`
// Inicializar base de datos
const initDB = async () => {
    try {
        await pool.query(\\\`
            CREATE TABLE IF NOT EXISTS usuario (
                idUsuario SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                fullName VARCHAR(255) NOT NULL,
                empresa VARCHAR(255)
            );
            
            CREATE TABLE IF NOT EXISTS grupo (
                idGrupo SERIAL PRIMARY KEY,
                idOwner INTEGER NOT NULL REFERENCES usuario(idUsuario),
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT
            );
            
            CREATE TABLE IF NOT EXISTS usuario_grupo (
                idUsuario INTEGER NOT NULL REFERENCES usuario(idUsuario),
                idGrupo INTEGER NOT NULL REFERENCES grupo(idGrupo),
                PRIMARY KEY (idUsuario, idGrupo)
            );
            
            CREATE TABLE IF NOT EXISTS invitacion (
                idInvitacion SERIAL PRIMARY KEY,
                idGrupo INTEGER REFERENCES grupo(idGrupo),
                idRemitente INTEGER REFERENCES usuario(idUsuario),
                emailDestinatario VARCHAR(255) NOT NULL,
                estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE'
            );
            
            CREATE TABLE IF NOT EXISTS vivienda (
                idVivienda SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                plano TEXT,
                idDuenyo INTEGER NOT NULL REFERENCES usuario(idUsuario),
                idGrupo INTEGER REFERENCES grupo(idGrupo)
            );
            
            CREATE TABLE IF NOT EXISTS mecanismos (
                idMecanismo SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                precioUnitario REAL NOT NULL,
                cantidad INTEGER NOT NULL,
                idVivienda INTEGER NOT NULL REFERENCES vivienda(idVivienda) ON DELETE CASCADE,
                foto TEXT,
                idHabitacion INTEGER REFERENCES habitacion(idHabitacion) ON DELETE SET NULL
            );
            
            CREATE TABLE IF NOT EXISTS presupuesto (
                idPresupuesto SERIAL PRIMARY KEY,
                idVivienda INTEGER NOT NULL REFERENCES vivienda(idVivienda) ON DELETE CASCADE,
                nombre VARCHAR(255) NOT NULL,
                fecha VARCHAR(100),
                clienteNombre VARCHAR(255),
                clienteDireccion TEXT,
                descuento REAL DEFAULT 0,
                iva REAL DEFAULT 21,
                notas TEXT,
                estado VARCHAR(50) DEFAULT 'BORRADOR'
            );
            
            CREATE TABLE IF NOT EXISTS presupuesto_mecanismo (
                idPresupuestoMecanismo SERIAL PRIMARY KEY,
                idPresupuesto INTEGER NOT NULL REFERENCES presupuesto(idPresupuesto) ON DELETE CASCADE,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                precioUnitario REAL NOT NULL,
                cantidad INTEGER NOT NULL,
                idHabitacion INTEGER REFERENCES habitacion(idHabitacion) ON DELETE SET NULL
            );
            
            CREATE TABLE IF NOT EXISTS presupuesto_anadido (
                idPresupuestoAnadido SERIAL PRIMARY KEY,
                idPresupuesto INTEGER NOT NULL REFERENCES presupuesto(idPresupuesto) ON DELETE CASCADE,
                concepto VARCHAR(255) NOT NULL,
                precioUnitario REAL NOT NULL,
                cantidad INTEGER NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS habitacion (
                idHabitacion SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                idVivienda INTEGER NOT NULL REFERENCES vivienda(idVivienda) ON DELETE CASCADE
            );
        \\\`);
        console.log("Database tables initialized successfully");
    } catch (err) {
        console.error("Error initializing tables:", err);
    }
};
initDB();

\`;

code = code.substring(0, serializeStart) + initDB + code.substring(authMiddlewareStart);

fs.writeFileSync('server.js', code);
console.log('Migration completed successfully.');
