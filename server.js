const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./database.sqlite");

// VIVIENDAS
app.get("/viviendas", (req, res) => {
    db.all("SELECT * FROM vivienda", [], (err, rows) => {
        if (err) {
            res.status(500).json(err);
            return;
        }
        res.json(rows);
    });
});

// MECANISMOS
app.get("/mecanismos", (req, res) => {
    db.all("SELECT * FROM mecanismos", [], (err, rows) => {
        if (err) {
            res.status(500).json(err);
            return;
        }
        res.json(rows);
    });
});

// USUARIO
app.get("/usuarios", (req, res) => {
    db.all("SELECT * FROM usuario", [], (err, rows) => {
        if (err) {
            res.status(500).json(err);
            return;
        }
        res.json(rows);
    })
})

// GRUPO
app.get("/grupos", (req, res) => {
    db.all("SELECT * FROM grupo", [], (err, rows) => {
        if (err) {
            res.status(500).json(err);
            return;
        }
        res.json(rows);
    })
})

app.listen(3000, () => {
    console.log("Servidor iniciado");
});