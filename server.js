const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

// MECANISMOS CRUD
app.post("/mecanismos", (req, res) => {
    const { nombre, descripcion, precioUnitario, cantidad, idVivienda, foto } = req.body;
    db.run(
        "INSERT INTO mecanismos (nombre, descripcion, precioUnitario, cantidad, idVivienda, foto) VALUES (?, ?, ?, ?, ?, ?)",
        [nombre, descripcion, precioUnitario, cantidad, idVivienda, foto],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(201).json({
                idMecanismo: this.lastID,
                nombre,
                descripcion,
                precioUnitario,
                cantidad,
                idVivienda,
                foto
            });
        }
    );
});

app.patch("/mecanismos/:id", (req, res) => {
    const id = req.params.id;
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(req.body)) {
        if (key === "idMecanismo") continue;
        fields.push(`${key} = ?`);
        values.push(value);
    }

    if (fields.length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
    }

    values.push(id);
    db.run(
        `UPDATE mecanismos SET ${fields.join(", ")} WHERE idMecanismo = ?`,
        values,
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: "Mecanismo no encontrado" });
                return;
            }
            res.json({ message: "Mecanismo actualizado correctamente" });
        }
    );
});

app.delete("/mecanismos/:id", (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM mecanismos WHERE idMecanismo = ?", [id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: "Mecanismo no encontrado" });
            return;
        }
        res.json({ message: "Mecanismo eliminado correctamente" });
    });
});

app.listen(3000, () => {
    console.log("Servidor iniciado");
});