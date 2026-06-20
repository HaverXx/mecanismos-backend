const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const db = new sqlite3.Database("./database.sqlite");
db.run("PRAGMA foreign_keys = ON;");

const JWT_SECRET = "super-secret-mecanismos-key";

// Asegurar índice único en email de usuario para evitar duplicidades
db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);", (err) => {
    if (err) {
        console.error("Error al crear índice único de email:", err);
    }
});

// Asegurar tablas de grupos, invitaciones y presupuestos
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS grupo (
            idGrupo INTEGER PRIMARY KEY AUTOINCREMENT,
            idOwner INTEGER NOT NULL,
            nombre VARCHAR NOT NULL,
            descripcion VARCHAR,
            FOREIGN KEY (idOwner) REFERENCES usuario(idUsuario)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS usuario_grupo (
            idUsuario INTEGER NOT NULL,
            idGrupo INTEGER NOT NULL,
            PRIMARY KEY (idUsuario, idGrupo),
            FOREIGN KEY (idUsuario) REFERENCES usuario(idUsuario),
            FOREIGN KEY (idGrupo) REFERENCES grupo(idGrupo)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS invitacion (
            idInvitacion INTEGER PRIMARY KEY AUTOINCREMENT,
            idGrupo INTEGER,
            idRemitente INTEGER,
            emailDestinatario VARCHAR NOT NULL,
            estado VARCHAR NOT NULL DEFAULT 'PENDIENTE',
            FOREIGN KEY (idGrupo) REFERENCES grupo(idGrupo),
            FOREIGN KEY (idRemitente) REFERENCES usuario(idUsuario)
        )
    `);
    // Añadir columna idGrupo a vivienda si no existe
    db.run("ALTER TABLE vivienda ADD COLUMN idGrupo INTEGER REFERENCES grupo(idGrupo)", (err) => {
        if (err && !err.message.includes("duplicate column")) {
            // Column already exists or other non-critical error, ignore
        }
    });
    // Tablas de presupuestos
    db.run(`
        CREATE TABLE IF NOT EXISTS presupuesto (
            idPresupuesto INTEGER PRIMARY KEY AUTOINCREMENT,
            idVivienda INTEGER NOT NULL,
            nombre VARCHAR NOT NULL,
            fecha VARCHAR,
            clienteNombre VARCHAR,
            clienteDireccion VARCHAR,
            descuento REAL DEFAULT 0,
            iva REAL DEFAULT 21,
            notas TEXT,
            estado VARCHAR DEFAULT 'BORRADOR',
            FOREIGN KEY (idVivienda) REFERENCES vivienda(idVivienda) ON DELETE CASCADE
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS presupuesto_mecanismo (
            idPresupuestoMecanismo INTEGER PRIMARY KEY AUTOINCREMENT,
            idPresupuesto INTEGER NOT NULL,
            nombre VARCHAR NOT NULL,
            descripcion VARCHAR,
            precioUnitario REAL NOT NULL,
            cantidad INTEGER NOT NULL,
            idHabitacion VARCHAR,
            FOREIGN KEY (idPresupuesto) REFERENCES presupuesto(idPresupuesto) ON DELETE CASCADE
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS presupuesto_anadido (
            idPresupuestoAnadido INTEGER PRIMARY KEY AUTOINCREMENT,
            idPresupuesto INTEGER NOT NULL,
            concepto VARCHAR NOT NULL,
            precioUnitario REAL NOT NULL,
            cantidad INTEGER NOT NULL,
            FOREIGN KEY (idPresupuesto) REFERENCES presupuesto(idPresupuesto) ON DELETE CASCADE
        )
    `);
});


// Middleware de autenticación JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Acceso no autorizado: Token no provisto." });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido o expirado." });
        }
        req.user = decoded; // decoded contiene idUsuario
        next();
    });
}

// ENDPOINTS DE AUTENTICACIÓN
app.post("/register", (req, res) => {
    const { email, password, fullName, empresa } = req.body;
    if (!email || !password || !fullName) {
        return res.status(400).json({ error: "El email, contraseña y nombre completo son requeridos." });
    }

    // Verificar si el usuario ya existe
    db.get("SELECT idUsuario FROM usuario WHERE email = ?", [email], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar el email en la base de datos." });
        }
        if (row) {
            return res.status(400).json({ error: "El correo electrónico ya está registrado." });
        }

        // Encriptar la contraseña con bcryptjs
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).json({ error: "Error al procesar la contraseña de forma segura." });
            }

            db.run(
                "INSERT INTO usuario (email, password, fullName, empresa) VALUES (?, ?, ?, ?)",
                [email, hashedPassword, fullName, empresa || null],
                function (err) {
                    if (err) {
                        return res.status(500).json({ error: "Error al registrar el usuario en la base de datos." });
                    }
                    res.status(201).json({
                        message: "Usuario registrado con éxito.",
                        idUsuario: this.lastID
                    });
                }
            );
        });
    });
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña son requeridos." });
    }

    db.get("SELECT * FROM usuario WHERE email = ?", [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Error en el servidor al buscar el usuario." });
        }
        if (!user) {
            return res.status(400).json({ error: "El email o la contraseña son incorrectos." });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                return res.status(500).json({ error: "Error al verificar la contraseña." });
            }
            if (!isMatch) {
                return res.status(400).json({ error: "El email o la contraseña son incorrectos." });
            }

            // Generar token JWT válido por 7 días
            const token = jwt.sign({ idUsuario: user.idUsuario }, JWT_SECRET, { expiresIn: "7d" });
            res.json({
                token,
                user: {
                    idUsuario: user.idUsuario,
                    email: user.email,
                    fullName: user.fullName,
                    empresa: user.empresa
                }
            });
        });
    });
});

// VIVIENDAS (Propias y compartidas por grupos del usuario)
app.get("/viviendas", authenticateToken, (req, res) => {
    db.all(`
        SELECT DISTINCT v.*, u.fullName as ownerName, g.nombre as grupoNombre
        FROM vivienda v
        LEFT JOIN usuario u ON v.idDuenyo = u.idUsuario
        LEFT JOIN grupo g ON v.idGrupo = g.idGrupo
        WHERE v.idDuenyo = ? 
           OR v.idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?)
    `, [req.user.idUsuario, req.user.idUsuario], (err, rows) => {
        if (err) {
            res.status(500).json({ error: "Error al obtener las viviendas de la base de datos." });
            return;
        }
        res.json(rows);
    });
});

app.post("/viviendas", authenticateToken, (req, res) => {
    const { nombre, plano, idGrupo } = req.body;
    
    const executeInsert = () => {
        db.run(
            "INSERT INTO vivienda (nombre, plano, idDuenyo, idGrupo) VALUES (?, ?, ?, ?)",
            [nombre, plano || null, req.user.idUsuario, idGrupo || null],
            function (err) {
                if (err) {
                    res.status(500).json({ error: "Error al registrar la vivienda en la base de datos." });
                    return;
                }
                res.status(201).json({
                    idVivienda: this.lastID,
                    nombre,
                    plano,
                    idDuenyo: req.user.idUsuario,
                    idGrupo: idGrupo || null
                });
            }
        );
    };

    if (idGrupo) {
        db.get(
            "SELECT idGrupo FROM grupo WHERE idGrupo = ? AND (idOwner = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))",
            [idGrupo, req.user.idUsuario, req.user.idUsuario],
            (err, row) => {
                if (err || !row) {
                    return res.status(403).json({ error: "No tienes permiso para compartir en este grupo o el grupo no existe." });
                }
                executeInsert();
            }
        );
    } else {
        executeInsert();
    }
});

app.patch("/viviendas/:id", authenticateToken, (req, res) => {
    const id = req.params.id;
    const { nombre, plano, idGrupo } = req.body;

    const executeUpdate = () => {
        db.run(
            "UPDATE vivienda SET nombre = ?, plano = ?, idGrupo = ? WHERE idVivienda = ? AND idDuenyo = ?",
            [nombre, plano, idGrupo || null, id, req.user.idUsuario],
            function (err) {
                if (err) {
                    res.status(500).json({ error: "Error al actualizar la vivienda en la base de datos." });
                    return;
                }
                if (this.changes === 0) {
                    res.status(404).json({ error: "Vivienda no encontrada o no autorizada" });
                    return;
                }
                res.json({ idVivienda: Number(id), nombre, plano, idGrupo: idGrupo || null });
            }
        );
    };

    if (idGrupo) {
        db.get(
            "SELECT idGrupo FROM grupo WHERE idGrupo = ? AND (idOwner = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))",
            [idGrupo, req.user.idUsuario, req.user.idUsuario],
            (err, row) => {
                if (err || !row) {
                    return res.status(403).json({ error: "No tienes permiso para compartir en este grupo o el grupo no existe." });
                }
                executeUpdate();
            }
        );
    } else {
        executeUpdate();
    }
});

app.delete("/viviendas/:id", authenticateToken, (req, res) => {
    const id = req.params.id;

    // Verificar propiedad antes de proceder
    db.get("SELECT idVivienda FROM vivienda WHERE idVivienda = ? AND idDuenyo = ?", [id, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar la propiedad de la vivienda." });
        }
        if (!row) {
            return res.status(404).json({ error: "Vivienda no encontrada o no autorizada." });
        }

        db.serialize(() => {
            // Eliminar mecanismos asociados
            db.run("DELETE FROM mecanismos WHERE idVivienda = ?", [id], (err) => {
                if (err) {
                    console.error("Error al eliminar mecanismos asociados:", err);
                }
            });
            // Eliminar la vivienda
            db.run("DELETE FROM vivienda WHERE idVivienda = ? AND idDuenyo = ?", [id, req.user.idUsuario], function (err) {
                if (err) {
                    res.status(500).json({ error: "Error al eliminar la vivienda de la base de datos." });
                    return;
                }
                res.json({ message: "Vivienda eliminada correctamente" });
            });
        });
    });
});

// MECANISMOS (Filtrado estricto por vivienda perteneciente al usuario)
app.get("/mecanismos", authenticateToken, (req, res) => {
    const idVivienda = req.query.idVivienda;
    if (!idVivienda) {
        return res.status(400).json({ error: "El parámetro idVivienda es requerido." });
    }

    // Verificar que la vivienda pertenece al usuario o a sus grupos
    db.get(`
        SELECT idVivienda FROM vivienda 
        WHERE idVivienda = ? 
          AND (idDuenyo = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [idVivienda, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar la propiedad de la vivienda." });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para acceder a los mecanismos de esta vivienda." });
        }

        db.all("SELECT * FROM mecanismos WHERE idVivienda = ?", [idVivienda], (err, rows) => {
            if (err) {
                res.status(500).json({ error: "Error al consultar los mecanismos." });
                return;
            }
            res.json(rows);
        });
    });
});

// USUARIO (Para administración si se necesitase)
app.get("/usuarios", authenticateToken, (req, res) => {
    db.all("SELECT idUsuario, email, fullName, empresa FROM usuario", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: "Error al obtener los usuarios." });
            return;
        }
        res.json(rows);
    });
});

// GRUPO ENDPOINTS

// Obtener los grupos del usuario (creados por él o a los que se ha unido)
app.get("/grupos/mis-grupos", authenticateToken, (req, res) => {
    db.all(`
        SELECT DISTINCT g.*, u.fullName as ownerName,
               (SELECT COUNT(*) FROM usuario_grupo ug WHERE ug.idGrupo = g.idGrupo) as memberCount
        FROM grupo g
        JOIN usuario u ON g.idOwner = u.idUsuario
        LEFT JOIN usuario_grupo ug ON g.idGrupo = ug.idGrupo
        WHERE g.idOwner = ? OR ug.idUsuario = ?
    `, [req.user.idUsuario, req.user.idUsuario], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Error al obtener los grupos." });
        }
        res.json(rows);
    });
});

// Crear un grupo nuevo
app.post("/grupos", authenticateToken, (req, res) => {
    const { nombre, descripcion } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: "El nombre del grupo es requerido." });
    }
    db.run(
        "INSERT INTO grupo (idOwner, nombre, descripcion) VALUES (?, ?, ?)",
        [req.user.idUsuario, nombre, descripcion || ""],
        function (err) {
            if (err) {
                return res.status(500).json({ error: "Error al crear el grupo." });
            }
            const idGrupo = this.lastID;
            // Unirse al grupo
            db.run(
                "INSERT INTO usuario_grupo (idUsuario, idGrupo) VALUES (?, ?)",
                [req.user.idUsuario, idGrupo],
                (err) => {
                    if (err) {
                        console.error("Error al autounirse al grupo:", err);
                    }
                    res.status(201).json({
                        idGrupo,
                        idOwner: req.user.idUsuario,
                        nombre,
                        descripcion: descripcion || "",
                        memberCount: 1
                    });
                }
            );
        }
    );
});

// Eliminar un grupo (solo el dueño)
app.delete("/grupos/:id", authenticateToken, (req, res) => {
    const idGrupo = req.params.id;
    db.get("SELECT idOwner FROM grupo WHERE idGrupo = ?", [idGrupo], (err, group) => {
        if (err) return res.status(500).json({ error: "Error al buscar el grupo." });
        if (!group) return res.status(404).json({ error: "Grupo no encontrado." });
        if (group.idOwner !== req.user.idUsuario) {
            return res.status(403).json({ error: "No tienes permiso para eliminar este grupo." });
        }
        db.serialize(() => {
            db.run("DELETE FROM usuario_grupo WHERE idGrupo = ?", [idGrupo]);
            db.run("DELETE FROM invitacion WHERE idGrupo = ?", [idGrupo]);
            db.run("UPDATE vivienda SET idGrupo = NULL WHERE idGrupo = ?", [idGrupo]);
            db.run("DELETE FROM grupo WHERE idGrupo = ?", [idGrupo], (err) => {
                if (err) return res.status(500).json({ error: "Error al eliminar el grupo." });
                res.json({ message: "Grupo eliminado correctamente." });
            });
        });
    });
});

// Transferir propiedad del grupo a otro miembro
app.patch("/grupos/:id/owner", authenticateToken, (req, res) => {
    const idGrupo = req.params.id;
    const { nuevoOwnerId } = req.body;
    if (!nuevoOwnerId) return res.status(400).json({ error: "El ID del nuevo propietario es requerido." });

    db.get("SELECT idOwner FROM grupo WHERE idGrupo = ?", [idGrupo], (err, group) => {
        if (err) return res.status(500).json({ error: "Error al buscar el grupo." });
        if (!group) return res.status(404).json({ error: "Grupo no encontrado." });
        if (group.idOwner !== req.user.idUsuario) {
            return res.status(403).json({ error: "Solo el propietario actual puede transferir la propiedad." });
        }

        // Verificar que el nuevo owner es miembro del grupo
        db.get("SELECT 1 FROM usuario_grupo WHERE idUsuario = ? AND idGrupo = ?", [nuevoOwnerId, idGrupo], (err, member) => {
            if (err) return res.status(500).json({ error: "Error de servidor." });
            if (!member) return res.status(400).json({ error: "El usuario debe ser miembro del grupo para ser propietario." });

            db.run("UPDATE grupo SET idOwner = ? WHERE idGrupo = ?", [nuevoOwnerId, idGrupo], (err) => {
                if (err) return res.status(500).json({ error: "Error al transferir la propiedad." });
                res.json({ message: "Propiedad transferida correctamente." });
            });
        });
    });
});

// Enviar invitación de grupo por email
app.post("/grupos/:id/invitar", authenticateToken, (req, res) => {
    const idGrupo = req.params.id;
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "El email del destinatario es requerido." });

    db.get("SELECT idOwner, nombre FROM grupo WHERE idGrupo = ?", [idGrupo], (err, group) => {
        if (err) return res.status(500).json({ error: "Error al buscar el grupo." });
        if (!group) return res.status(404).json({ error: "Grupo no encontrado." });
        if (group.idOwner !== req.user.idUsuario) {
            return res.status(403).json({ error: "Sólo el propietario del grupo puede invitar miembros." });
        }

        // Buscar si el email existe
        db.get("SELECT idUsuario FROM usuario WHERE email = ?", [email], (err, user) => {
            if (err) return res.status(500).json({ error: "Error al buscar el usuario." });
            if (!user) return res.status(404).json({ error: "El usuario con ese correo no está registrado." });

            // Verificar si ya es miembro
            db.get("SELECT 1 FROM usuario_grupo WHERE idUsuario = ? AND idGrupo = ?", [user.idUsuario, idGrupo], (err, member) => {
                if (member) return res.status(400).json({ error: "El usuario ya es miembro de este grupo." });

                // Verificar si hay una invitación pendiente
                db.get("SELECT 1 FROM invitacion WHERE idGrupo = ? AND emailDestinatario = ? AND estado = 'PENDIENTE'", [idGrupo, email], (err, inv) => {
                    if (inv) return res.status(400).json({ error: "Ya hay una invitación pendiente para este usuario." });

                    db.run(
                        "INSERT INTO invitacion (idGrupo, idRemitente, emailDestinatario, estado) VALUES (?, ?, ?, 'PENDIENTE')",
                        [idGrupo, req.user.idUsuario, email],
                        function (err) {
                            if (err) return res.status(500).json({ error: "Error al enviar la invitación." });
                            res.status(201).json({ message: "Invitación enviada con éxito." });
                        }
                    );
                });
            });
        });
    });
});

// Obtener invitaciones pendientes
app.get("/invitaciones/recibidas", authenticateToken, (req, res) => {
    db.get("SELECT email FROM usuario WHERE idUsuario = ?", [req.user.idUsuario], (err, user) => {
        if (err || !user) return res.status(500).json({ error: "Error al buscar datos del usuario." });
        db.all(`
            SELECT i.*, g.nombre as nombreGrupo, u.fullName as nombreRemitente
            FROM invitacion i
            JOIN grupo g ON i.idGrupo = g.idGrupo
            JOIN usuario u ON i.idRemitente = u.idUsuario
            WHERE i.emailDestinatario = ? AND i.estado = 'PENDIENTE'
        `, [user.email], (err, rows) => {
            if (err) return res.status(500).json({ error: "Error al obtener las invitaciones." });
            res.json(rows);
        });
    });
});

// Responder a una invitación (aceptar/rechazar)
app.post("/invitaciones/:id/responder", authenticateToken, (req, res) => {
    const idInvitacion = req.params.id;
    const { accion } = req.body; // 'aceptar' o 'rechazar'
    if (!['aceptar', 'rechazar'].includes(accion)) {
        return res.status(400).json({ error: "Acción inválida. Debe ser 'aceptar' o 'rechazar'." });
    }

    db.get("SELECT email FROM usuario WHERE idUsuario = ?", [req.user.idUsuario], (err, user) => {
        if (err || !user) return res.status(500).json({ error: "Error de usuario." });

        db.get("SELECT * FROM invitacion WHERE idInvitacion = ?", [idInvitacion], (err, inv) => {
            if (err) return res.status(500).json({ error: "Error al buscar la invitación." });
            if (!inv) return res.status(404).json({ error: "Invitación no encontrada." });
            if (inv.emailDestinatario !== user.email) {
                return res.status(403).json({ error: "No tienes permiso para responder a esta invitación." });
            }

            const nuevoEstado = accion === 'aceptar' ? 'ACEPTADA' : 'RECHAZADA';
            db.run("UPDATE invitacion SET estado = ? WHERE idInvitacion = ?", [nuevoEstado, idInvitacion], (err) => {
                if (err) return res.status(500).json({ error: "Error al responder la invitación." });

                if (accion === 'aceptar') {
                    db.run(
                        "INSERT OR IGNORE INTO usuario_grupo (idUsuario, idGrupo) VALUES (?, ?)",
                        [req.user.idUsuario, inv.idGrupo],
                        (err) => {
                            if (err) return res.status(500).json({ error: "Error al unirse al grupo." });
                            res.json({ message: "Invitación aceptada. Te has unido al grupo." });
                        }
                    );
                } else {
                    res.json({ message: "Invitación rechazada." });
                }
            });
        });
    });
});

// Obtener miembros del grupo
app.get("/grupos/:id/miembros", authenticateToken, (req, res) => {
    const idGrupo = req.params.id;
    db.get(`
        SELECT 1 FROM grupo g
        LEFT JOIN usuario_grupo ug ON g.idGrupo = ug.idGrupo
        WHERE g.idGrupo = ? AND (g.idOwner = ? OR ug.idUsuario = ?)
    `, [idGrupo, req.user.idUsuario, req.user.idUsuario], (err, access) => {
        if (err) return res.status(500).json({ error: "Error de servidor." });
        if (!access) return res.status(403).json({ error: "No tienes permiso para ver los miembros." });

        db.all(`
            SELECT u.idUsuario, u.email, u.fullName, u.empresa,
                   CASE WHEN g.idOwner = u.idUsuario THEN 1 ELSE 0 END as isOwner
            FROM usuario_grupo ug
            JOIN usuario u ON ug.idUsuario = u.idUsuario
            JOIN grupo g ON ug.idGrupo = g.idGrupo
            WHERE ug.idGrupo = ?
        `, [idGrupo], (err, rows) => {
            if (err) return res.status(500).json({ error: "Error al obtener miembros." });
            res.json(rows);
        });
    });
});

// Salir del grupo o expulsar miembro
app.delete("/grupos/:idGrupo/miembros/:idUsuario", authenticateToken, (req, res) => {
    const { idGrupo, idUsuario } = req.params;
    db.get("SELECT idOwner FROM grupo WHERE idGrupo = ?", [idGrupo], (err, group) => {
        if (err || !group) return res.status(500).json({ error: "Error de servidor." });

        const isOwner = group.idOwner === req.user.idUsuario;
        const isSelf = Number(idUsuario) === req.user.idUsuario;

        if (!isOwner && !isSelf) {
            return res.status(403).json({ error: "No tienes permiso para realizar esta acción." });
        }
        if (isOwner && isSelf) {
            return res.status(400).json({ error: "El dueño no puede salir del grupo. Debe eliminar el grupo." });
        }

        db.run("DELETE FROM usuario_grupo WHERE idGrupo = ? AND idUsuario = ?", [idGrupo, idUsuario], (err) => {
            if (err) return res.status(500).json({ error: "Error al eliminar miembro." });
            res.json({ message: "Miembro eliminado correctamente." });
        });
    });
});

// MECANISMOS CRUD
app.post("/mecanismos", authenticateToken, (req, res) => {
    const { nombre, descripcion, precioUnitario, cantidad, idVivienda, foto, idHabitacion } = req.body;
    if (!idVivienda) {
        return res.status(400).json({ error: "El parámetro idVivienda es requerido." });
    }

    // Verificar que la vivienda pertenece al usuario logueado o a sus grupos
    db.get(`
        SELECT idVivienda FROM vivienda 
        WHERE idVivienda = ? 
          AND (idDuenyo = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [idVivienda, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar la propiedad de la vivienda." });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para añadir mecanismos en esta vivienda." });
        }

        db.run(
            "INSERT INTO mecanismos (nombre, descripcion, precioUnitario, cantidad, idVivienda, foto, idHabitacion) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [nombre, descripcion, precioUnitario, cantidad, idVivienda, foto, idHabitacion || null],
            function (err) {
                if (err) {
                    res.status(500).json({ error: "Error al registrar el mecanismo." });
                    return;
                }
                res.status(201).json({
                    idMecanismo: this.lastID,
                    nombre,
                    descripcion,
                    precioUnitario,
                    cantidad,
                    idVivienda,
                    foto,
                    idHabitacion: idHabitacion || null
                });
            }
        );
    });
});

app.patch("/mecanismos/:id", authenticateToken, (req, res) => {
    const id = req.params.id;

    // Verificar pertenencia del mecanismo al usuario a través de la vivienda (dueño o miembro del grupo)
    db.get(`
        SELECT m.idMecanismo FROM mecanismos m 
        JOIN vivienda v ON m.idVivienda = v.idVivienda 
        WHERE m.idMecanismo = ? 
          AND (v.idDuenyo = ? OR v.idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [id, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar los permisos del mecanismo." });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para actualizar este mecanismo." });
        }

        const fields = [];
        const values = [];
        const allowedFields = ["nombre", "descripcion", "precioUnitario", "cantidad", "idVivienda", "foto", "idHabitacion"];

        for (const [key, value] of Object.entries(req.body)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            res.status(400).json({ error: "No hay campos válidos para actualizar" });
            return;
        }

        values.push(id);
        db.run(
            `UPDATE mecanismos SET ${fields.join(", ")} WHERE idMecanismo = ?`,
            values,
            function (err) {
                if (err) {
                    res.status(500).json({ error: "Error al actualizar el mecanismo." });
                    return;
                }
                res.json({ message: "Mecanismo actualizado correctamente" });
            }
        );
    });
});

app.delete("/mecanismos/:id", authenticateToken, (req, res) => {
    const id = req.params.id;

    // Verificar pertenencia del mecanismo al usuario a través de la vivienda (dueño o miembro del grupo)
    db.get(`
        SELECT m.idMecanismo FROM mecanismos m 
        JOIN vivienda v ON m.idVivienda = v.idVivienda 
        WHERE m.idMecanismo = ? 
          AND (v.idDuenyo = ? OR v.idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [id, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar los permisos del mecanismo." });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para eliminar este mecanismo." });
        }

        db.run("DELETE FROM mecanismos WHERE idMecanismo = ?", [id], function (err) {
            if (err) {
                res.status(500).json({ error: "Error al eliminar el mecanismo de la base de datos." });
                return;
            }
            res.json({ message: "Mecanismo eliminado correctamente" });
        });
    });
});

// --- ENDPOINTS DE PRESUPUESTOS ---

// Obtener presupuestos de una vivienda
app.get("/presupuestos", authenticateToken, (req, res) => {
    const idVivienda = req.query.idVivienda;
    if (!idVivienda) {
        return res.status(400).json({ error: "El parámetro idVivienda es requerido." });
    }

    // Verificar permisos sobre la vivienda
    db.get(`
        SELECT idVivienda FROM vivienda 
        WHERE idVivienda = ? 
          AND (idDuenyo = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [idVivienda, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar permisos de la vivienda." });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para acceder a los presupuestos de esta vivienda." });
        }

        db.all("SELECT * FROM presupuesto WHERE idVivienda = ?", [idVivienda], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: "Error al consultar los presupuestos." });
            }
            res.json(rows);
        });
    });
});

// Obtener el detalle de un presupuesto (incluyendo mecanismos y añadidos)
app.get("/presupuestos/:id", authenticateToken, (req, res) => {
    const id = req.params.id;

    // Verificar pertenencia del presupuesto a través de su vivienda
    db.get(`
        SELECT p.* FROM presupuesto p
        JOIN vivienda v ON p.idVivienda = v.idVivienda
        WHERE p.idPresupuesto = ?
          AND (v.idDuenyo = ? OR v.idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [id, req.user.idUsuario, req.user.idUsuario], (err, rowPresupuesto) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar permisos del presupuesto." });
        }
        if (!rowPresupuesto) {
            return res.status(403).json({ error: "No tienes permiso para acceder a este presupuesto." });
        }

        // Obtener mecanismos del presupuesto
        db.all("SELECT * FROM presupuesto_mecanismo WHERE idPresupuesto = ?", [id], (err, rowMecanismos) => {
            if (err) {
                return res.status(500).json({ error: "Error al obtener mecanismos del presupuesto." });
            }

            // Obtener añadidos del presupuesto
            db.all("SELECT * FROM presupuesto_anadido WHERE idPresupuesto = ?", [id], (err, rowAnadidos) => {
                if (err) {
                    return res.status(500).json({ error: "Error al obtener añadidos del presupuesto." });
                }

                res.json({
                    ...rowPresupuesto,
                    mecanismos: rowMecanismos,
                    anadidos: rowAnadidos
                });
            });
        });
    });
});

// Crear un nuevo presupuesto
app.post("/presupuestos", authenticateToken, (req, res) => {
    const { idVivienda, nombre, fecha, clienteNombre, clienteDireccion, descuento, iva, notas, estado } = req.body;
    if (!idVivienda || !nombre) {
        return res.status(400).json({ error: "Los parámetros idVivienda y nombre son requeridos." });
    }

    // Verificar permisos sobre la vivienda
    db.get(`
        SELECT idVivienda FROM vivienda 
        WHERE idVivienda = ? 
          AND (idDuenyo = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [idVivienda, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar permisos de la vivienda." });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para crear presupuestos en esta vivienda." });
        }

        // Insertar presupuesto
        db.run(
            `INSERT INTO presupuesto (idVivienda, nombre, fecha, clienteNombre, clienteDireccion, descuento, iva, notas, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [idVivienda, nombre, fecha || null, clienteNombre || null, clienteDireccion || null, descuento || 0, iva || 21, notas || "", estado || "BORRADOR"],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: "Error al registrar el presupuesto." });
                }
                const idPresupuesto = this.lastID;

                // Clonar mecanismos de la vivienda al presupuesto
                db.all("SELECT nombre, descripcion, precioUnitario, cantidad, idHabitacion FROM mecanismos WHERE idVivienda = ?", [idVivienda], (err, rowsMecanismos) => {
                    if (err || rowsMecanismos.length === 0) {
                        return res.status(201).json({
                            idPresupuesto,
                            idVivienda,
                            nombre,
                            fecha,
                            clienteNombre,
                            clienteDireccion,
                            descuento: descuento || 0,
                            iva: iva || 21,
                            notas: notas || "",
                            estado: estado || "BORRADOR",
                            mecanismos: [],
                            anadidos: []
                        });
                    }

                    const placeholders = rowsMecanismos.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
                    const stmtValues = [];
                    rowsMecanismos.forEach(m => {
                        stmtValues.push(idPresupuesto, m.nombre, m.descripcion, m.precioUnitario, m.cantidad, m.idHabitacion);
                    });

                    db.run(
                        `INSERT INTO presupuesto_mecanismo (idPresupuesto, nombre, descripcion, precioUnitario, cantidad, idHabitacion)
                         VALUES ${placeholders}`,
                        stmtValues,
                        function (err) {
                            if (err) {
                                console.error("Error al clonar los mecanismos:", err);
                            }
                            res.status(201).json({
                                idPresupuesto,
                                idVivienda,
                                nombre,
                                fecha,
                                clienteNombre,
                                clienteDireccion,
                                descuento: descuento || 0,
                                iva: iva || 21,
                                notas: notas || "",
                                estado: estado || "BORRADOR",
                                mecanismos: rowsMecanismos,
                                anadidos: []
                            });
                        }
                    );
                });
            }
        );
    });
});

// Actualizar presupuesto (cabecera, mecanismos y añadidos)
app.patch("/presupuestos/:id", authenticateToken, (req, res) => {
    const id = req.params.id;
    const { nombre, fecha, clienteNombre, clienteDireccion, descuento, iva, notas, estado, mecanismos, anadidos } = req.body;

    // Verificar pertenencia del presupuesto a través de su vivienda
    db.get(`
        SELECT p.idPresupuesto FROM presupuesto p
        JOIN vivienda v ON p.idVivienda = v.idVivienda
        WHERE p.idPresupuesto = ?
          AND (v.idDuenyo = ? OR v.idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [id, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            console.error("Error al verificar permisos:", err);
            return res.status(500).json({ error: "Error al verificar permisos: " + err.message });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para actualizar este presupuesto." });
        }

        // 1. Actualizar campos de cabecera
        const fields = [];
        const values = [];
        const allowedFields = ["nombre", "fecha", "clienteNombre", "clienteDireccion", "descuento", "iva", "notas", "estado"];

        for (const [key, value] of Object.entries(req.body)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        const updateCabecera = (callback) => {
            if (fields.length === 0) {
                return callback(null);
            }
            values.push(id);
            db.run(`UPDATE presupuesto SET ${fields.join(", ")} WHERE idPresupuesto = ?`, values, function (err) {
                callback(err);
            });
        };

        db.serialize(() => {
            updateCabecera((err) => {
                if (err) {
                    console.error("Error al actualizar cabecera del presupuesto:", err);
                    return res.status(500).json({ error: "Error al actualizar cabecera del presupuesto: " + err.message });
                }

                // 2. Si vienen mecanismos, los reemplazamos de forma atómica
                const updateMecanismos = (nextStep) => {
                    if (!mecanismos) return nextStep();
                    db.run("DELETE FROM presupuesto_mecanismo WHERE idPresupuesto = ?", [id], (err) => {
                        if (err) {
                            console.error("Error al limpiar mecanismos previos del presupuesto:", err);
                            return res.status(500).json({ error: "Error al limpiar mecanismos previos del presupuesto: " + err.message });
                        }
                        if (mecanismos.length === 0) return nextStep();

                        const placeholders = mecanismos.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
                        const stmtValues = [];
                        mecanismos.forEach(m => {
                            stmtValues.push(id, m.nombre, m.descripcion || null, m.precioUnitario, m.cantidad, m.idHabitacion || null);
                        });

                        db.run(
                            `INSERT INTO presupuesto_mecanismo (idPresupuesto, nombre, descripcion, precioUnitario, cantidad, idHabitacion)
                             VALUES ${placeholders}`,
                            stmtValues,
                            function (err) {
                                if (err) {
                                    console.error("Error al insertar nuevos mecanismos en presupuesto:", err);
                                    return res.status(500).json({ error: "Error al insertar nuevos mecanismos en presupuesto: " + err.message });
                                }
                                nextStep();
                            }
                        );
                    });
                };

                // 3. Si vienen añadidos, los reemplazamos de forma atómica
                const updateAnadidos = () => {
                    if (!anadidos) {
                        return res.json({ message: "Presupuesto actualizado correctamente" });
                    }
                    db.run("DELETE FROM presupuesto_anadido WHERE idPresupuesto = ?", [id], (err) => {
                        if (err) {
                            console.error("Error al limpiar añadidos previos:", err);
                            return res.status(500).json({ error: "Error al limpiar añadidos previos: " + err.message });
                        }
                        if (anadidos.length === 0) {
                            return res.json({ message: "Presupuesto actualizado correctamente" });
                        }

                        const placeholders = anadidos.map(() => "(?, ?, ?, ?)").join(", ");
                        const stmtValues = [];
                        anadidos.forEach(a => {
                            stmtValues.push(id, a.concepto, a.precioUnitario, a.cantidad);
                        });

                        db.run(
                            `INSERT INTO presupuesto_anadido (idPresupuesto, concepto, precioUnitario, cantidad)
                             VALUES ${placeholders}`,
                            stmtValues,
                            function (err) {
                                if (err) {
                                    console.error("Error al insertar nuevos añadidos:", err);
                                    return res.status(500).json({ error: "Error al insertar nuevos añadidos: " + err.message });
                                }
                                res.json({ message: "Presupuesto actualizado correctamente" });
                            }
                        );
                    });
                };

                updateMecanismos(() => {
                    updateAnadidos();
                });
            });
        });
    });
});

// Eliminar un presupuesto
app.delete("/presupuestos/:id", authenticateToken, (req, res) => {
    const id = req.params.id;

    // Verificar pertenencia del presupuesto a través de su vivienda
    db.get(`
        SELECT p.idPresupuesto FROM presupuesto p
        JOIN vivienda v ON p.idVivienda = v.idVivienda
        WHERE p.idPresupuesto = ?
          AND (v.idDuenyo = ? OR v.idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
    `, [id, req.user.idUsuario, req.user.idUsuario], (err, row) => {
        if (err) {
            return res.status(500).json({ error: "Error al verificar permisos." });
        }
        if (!row) {
            return res.status(403).json({ error: "No tienes permiso para eliminar este presupuesto." });
        }

        db.serialize(() => {
            db.run("DELETE FROM presupuesto_mecanismo WHERE idPresupuesto = ?", [id]);
            db.run("DELETE FROM presupuesto_anadido WHERE idPresupuesto = ?", [id]);
            db.run("DELETE FROM presupuesto WHERE idPresupuesto = ?", [id], function (err) {
                if (err) {
                    return res.status(500).json({ error: "Error al eliminar el presupuesto." });
                }
                res.json({ message: "Presupuesto eliminado correctamente." });
            });
        });
    });
});

app.listen(3000, () => {
    console.log("Servidor iniciado");
});