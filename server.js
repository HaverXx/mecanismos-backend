const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const pool = new Pool({
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
        if (keyMap[key.toLowerCase()]) {
            newRow[keyMap[key.toLowerCase()]] = row[key];
        } else {
            newRow[key] = row[key];
        }
    }
    return newRow;
}

function convertQuery(query) {
    let index = 1;
    return query.replace(/\?/g, () => `$${index++}`);
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
                const context = { changes: res.rowCount, lastID: null, lastRow: null };
                if (isInsert && res.rows.length > 0) {
                    const rawRow = res.rows[0];
                    const row = mapKeys(rawRow);
                    context.lastRow = row;
                    
                    // Buscar el ID en la fila mapeada (camelCase)
                    let idCol = Object.keys(row).find(k => 
                        (k.toLowerCase().includes('presupuesto') || 
                         k.toLowerCase().includes('vivienda') || 
                         k.toLowerCase().includes('usuario') || 
                         k.toLowerCase().includes('grupo') || 
                         k.toLowerCase().includes('habitacion') || 
                         k.toLowerCase().includes('mecanismo')) && 
                        k.toLowerCase().includes('id')
                    );
                    
                    if (idCol) {
                        context.lastID = row[idCol];
                    } else {
                        // Si no encontró, buscar el primer campo que empiece con 'id'
                        idCol = Object.keys(row).find(k => k.toLowerCase().startsWith('id'));
                        if (idCol) context.lastID = row[idCol];
                    }
                }
                if (callback) callback.call(context, null);
            })
            .catch(err => {
                console.error("DB RUN ERROR:", err, "\\nQuery:", pgQuery);
                if (callback) callback.call({ changes: 0, lastID: null, lastRow: null }, err);
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
                console.error("DB GET ERROR:", err, "\\nQuery:", convertQuery(query));
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
                console.error("DB ALL ERROR:", err, "\\nQuery:", convertQuery(query));
                if (callback) callback(err, null);
            });
    },
    serialize: function(callback) {
        callback();
    }
};

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-mecanismos-key";

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
            "INSERT INTO vivienda (nombre, plano, idduenyo, idgrupo) VALUES (?, ?, ?, ?)",
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

        // Eliminar mecanismos primero
        db.run("DELETE FROM mecanismos WHERE idVivienda = ?", [id], (err) => {
            if (err) {
                console.error("Error al eliminar mecanismos asociados:", err);
                return res.status(500).json({ error: "Error al eliminar mecanismos asociados." });
            }
            // Luego eliminar la vivienda
            db.run("DELETE FROM vivienda WHERE idVivienda = ? AND idDuenyo = ?", [id, req.user.idUsuario], function (err) {
                if (err) {
                    return res.status(500).json({ error: "Error al eliminar la vivienda de la base de datos." });
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
    // Obtener solo usuarios de grupos compartidos para invitaciones o colaboración
    // Devolver usuarios de los mismos grupos (excluye al usuario actual)
    db.all(`
        SELECT DISTINCT u.idUsuario, u.email, u.fullName, u.empresa 
        FROM usuario u
        JOIN usuario_grupo ug ON u.idUsuario = ug.idUsuario
        WHERE ug.idGrupo IN (
            SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?
        )
        AND u.idUsuario != ?
        ORDER BY u.fullName
    `, [req.user.idUsuario, req.user.idUsuario], (err, rows) => {
        if (err) {
            res.status(500).json({ error: "Error al obtener los usuarios." });
            return;
        }
        res.json(rows || []);
    });
});

// GRUPO ENDPOINTS

// Obtener los grupos del usuario (creados por él o a los que se ha unido)
app.get("/grupos/mis-grupos", authenticateToken, (req, res) => {
    db.all(`
        SELECT g.*, u.fullname as ownername,
               (SELECT COUNT(*) FROM usuario_grupo ug WHERE ug.idgrupo = g.idgrupo) as membercount
        FROM grupo g
        JOIN usuario u ON g.idowner = u.idusuario
        WHERE g.idowner = ? 
           OR g.idgrupo IN (SELECT idgrupo FROM usuario_grupo WHERE idusuario = ?)
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
        "INSERT INTO grupo (idowner, nombre, descripcion) VALUES (?, ?, ?)",
        [req.user.idUsuario, nombre, descripcion || ""],
        function (err) {
            if (err) {
                return res.status(500).json({ error: "Error al crear el grupo." });
            }
            const idGrupo = this.lastID;
            console.error("DEBUG POST grupos - lastID:", this.lastID, "lastRow:", JSON.stringify(this.lastRow));
            // Unirse al grupo
            db.run(
                "INSERT INTO usuario_grupo (idusuario, idgrupo) VALUES (?, ?)",
                [req.user.idUsuario, idGrupo],
                (err) => {
                    if (err) {
                        console.error("Error al autounirse al grupo:", err);
                    }
                    res.status(201).json({
                        idGrupo: idGrupo,
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
    db.get("SELECT idowner FROM grupo WHERE idgrupo = ?", [idGrupo], (err, group) => {
        if (err) return res.status(500).json({ error: "Error al buscar el grupo." });
        if (!group) return res.status(404).json({ error: "Grupo no encontrado." });
        if (group.idOwner !== req.user.idUsuario) {
            return res.status(403).json({ error: "No tienes permiso para eliminar este grupo." });
        }
        db.serialize(() => {
            db.run("DELETE FROM usuario_grupo WHERE idgrupo = ?", [idGrupo]);
            db.run("DELETE FROM invitacion WHERE idgrupo = ?", [idGrupo]);
            db.run("UPDATE vivienda SET idgrupo = NULL WHERE idgrupo = ?", [idGrupo]);
            db.run("DELETE FROM grupo WHERE idgrupo = ?", [idGrupo], (err) => {
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
        LEFT JOIN usuario_grupo ug ON g.idgrupo = ug.idgrupo
        WHERE g.idgrupo = ? AND (g.idowner = ? OR ug.idusuario = ?)
    `, [idGrupo, req.user.idUsuario, req.user.idUsuario], (err, access) => {
        if (err) return res.status(500).json({ error: "Error de servidor." });
        if (!access) return res.status(403).json({ error: "No tienes permiso para ver los miembros." });

        db.all(`
            SELECT u.idusuario, u.email, u.fullname, u.empresa,
                   CASE WHEN g.idowner = u.idusuario THEN 1 ELSE 0 END as isowner
            FROM usuario_grupo ug
            JOIN usuario u ON ug.idusuario = u.idusuario
            JOIN grupo g ON ug.idgrupo = g.idgrupo
            WHERE ug.idgrupo = ?
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
            "INSERT INTO mecanismos (nombre, descripcion, preciounitario, cantidad, idvivienda, foto, idhabitacion) VALUES (?, ?, ?, ?, ?, ?, ?)",
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
    console.log("GET /presupuestos/:id called with id:", id);

    // Obtener presupuesto directamente (simplificado)
    db.get(`
        SELECT p.* FROM presupuesto p
        WHERE p.idPresupuesto = ?
    `, [id], (err, rowPresupuesto) => {
        if (err) {
            console.error("Error obtener presupuesto:", err);
            return res.status(500).json({ error: "Error al obtener el presupuesto." });
        }
        if (!rowPresupuesto) {
            return res.status(404).json({ error: "Presupuesto no encontrado." });
        }

        // Verificar permisos sobre la vivienda
        db.get(`
            SELECT idVivienda FROM vivienda 
            WHERE idVivienda = ? 
              AND (idDuenyo = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
        `, [rowPresupuesto.idVivienda, req.user.idUsuario, req.user.idUsuario], (err, vivRow) => {
            if (err || !vivRow) {
                return res.status(403).json({ error: "No tienes permiso para acceder a este presupuesto." });
            }

            // Obtener mecanismos del presupuesto
            db.all("SELECT * FROM presupuesto_mecanismo WHERE idPresupuesto = ?", [id], (err, rowMecanismos) => {
                if (err) {
                    console.error("Error al obtener mecanismos:", err);
                    return res.status(500).json({ error: "Error al obtener mecanismos del presupuesto." });
                }

                // Obtener añadidos del presupuesto
                db.all("SELECT * FROM presupuesto_anadido WHERE idPresupuesto = ?", [id], (err, rowAnadidos) => {
                    if (err) {
                        console.error("Error al obtener añadidos:", err);
                        return res.status(500).json({ error: "Error al obtener añadidos del presupuesto." });
                    }

                    const response = {
                        ...rowPresupuesto,
                        mecanismos: rowMecanismos || [],
                        anadidos: rowAnadidos || []
                    };
                    
                    console.log("GET presupuesto/:id - idPresupuesto:", id, "tiene mecanismos:", (rowMecanismos || []).length);
                    
                    res.json(response);
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
            `INSERT INTO presupuesto (idvivienda, nombre, fecha, clientenombre, clientedireccion, descuento, iva, notas, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [idVivienda, nombre, fecha || null, clienteNombre || null, clienteDireccion || null, descuento || 0, iva || 21, notas || "", estado || "BORRADOR"],
            function (err) {
                if (err) {
                    console.error("Error al registrar presupuesto:", err);
                    return res.status(500).json({ error: "Error al registrar el presupuesto." });
                }
                
                console.error("DEBUG POST presupuestos - lastRow:", JSON.stringify(this.lastRow), "lastID:", this.lastID);
                
                // Obtener el ID del presupuesto insertado
                let idPresupuesto = null;
                if (this.lastRow && this.lastRow.idPresupuesto) {
                    idPresupuesto = this.lastRow.idPresupuesto;
                } else if (this.lastID) {
                    idPresupuesto = this.lastID;
                }
                
                if (!idPresupuesto) {
                    console.error("No se pudo obtener idPresupuesto. lastRow:", this.lastRow, "lastID:", this.lastID);
                    return res.status(500).json({ error: "Error al obtener ID del presupuesto creado." });
                }
                
                // Datos base del presupuesto
                const presupuestoData = {
                    idPresupuesto,
                    idVivienda,
                    nombre,
                    fecha: fecha || null,
                    clienteNombre: clienteNombre || null,
                    clienteDireccion: clienteDireccion || null,
                    descuento: parseFloat(descuento) || 0,
                    iva: parseFloat(iva) || 21,
                    notas: notas || "",
                    estado: estado || "BORRADOR",
                    mecanismos: [],
                    anadidos: []
                };
                
                console.log("POST presupuesto - id creado:", idPresupuesto);

                // Clonar mecanismos de la vivienda al presupuesto (sin bloquear la respuesta)
                db.all("SELECT nombre, descripcion, precioUnitario, cantidad, idHabitacion FROM mecanismos WHERE idVivienda = ?", [idVivienda], (err, rowsMecanismos) => {
                    if (err) {
                        console.error("Error al obtener mecanismos:", err);
                        // Continuar de todas formas
                        return;
                    }
                    
                    if (!rowsMecanismos || rowsMecanismos.length === 0) {
                        return;
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
                                console.error("Error al clonar mecanismos:", err);
                            } else {
                                console.log("Mecanismos clonados para presupuesto:", idPresupuesto);
                            }
                        }
                    );
                });
                
                // Devolver la respuesta INMEDIATAMENTE con los datos del presupuesto
                res.status(201).json(presupuestoData);
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

// Eliminar un presupuesto
app.delete("/presupuestos/:id", authenticateToken, (req, res) => {
    const id = req.params.id;
    console.log("DELETE /presupuestos/:id called with id:", id);

    // Verificar pertenencia del presupuesto a través de su vivienda (simplificado)
    db.get(`
        SELECT p.idPresupuesto, p.idVivienda FROM presupuesto p
        WHERE p.idPresupuesto = ?
    `, [id], (err, row) => {
        if (err) {
            console.error("Error checking presupuesto:", err);
            return res.status(500).json({ error: "Error al verificar permisos." });
        }
        if (!row) {
            return res.status(404).json({ error: "Presupuesto no encontrado." });
        }

        // Verificar permisos sobre la vivienda
        db.get(`
            SELECT idVivienda FROM vivienda 
            WHERE idVivienda = ? 
              AND (idDuenyo = ? OR idGrupo IN (SELECT idGrupo FROM usuario_grupo WHERE idUsuario = ?))
        `, [row.idVivienda, req.user.idUsuario, req.user.idUsuario], (err, vivRow) => {
            if (err || !vivRow) {
                return res.status(403).json({ error: "No tienes permiso para eliminar este presupuesto." });
            }

            // Eliminar primero mecanismos asociados
            db.run("DELETE FROM presupuesto_mecanismo WHERE idPresupuesto = ?", [id], (err) => {
                if (err) {
                    console.error("Error al eliminar mecanismos del presupuesto:", err);
                    return res.status(500).json({ error: "Error al eliminar mecanismos del presupuesto." });
                }
                // Luego eliminar añadidos
                db.run("DELETE FROM presupuesto_anadido WHERE idPresupuesto = ?", [id], (err) => {
                    if (err) {
                        console.error("Error al eliminar añadidos del presupuesto:", err);
                        return res.status(500).json({ error: "Error al eliminar añadidos del presupuesto." });
                    }
                    // Finalmente eliminar el presupuesto
                    db.run("DELETE FROM presupuesto WHERE idPresupuesto = ?", [id], function (err) {
                        if (err) {
                            console.error("Error al eliminar el presupuesto:", err);
                            return res.status(500).json({ error: "Error al eliminar el presupuesto." });
                        }
                        console.log("Presupuesto eliminado correctamente:", id);
                        res.json({ message: "Presupuesto eliminado correctamente." });
                    });
                });
            });
        });
    });
});

// ===== HABITACIONES =====
app.get("/habitaciones", authenticateToken, (req, res) => {
    const { idVivienda } = req.query;
    if (!idVivienda) return res.status(400).json({ error: "idVivienda requerido" });
    db.all("SELECT * FROM habitacion WHERE idVivienda = ? ORDER BY nombre", [idVivienda], (err, rows) => {
        if (err) {
            console.error("Error al obtener habitaciones:", err);
            return res.status(500).json({ error: "Error al obtener habitaciones" });
        }
        console.log("Habitaciones obtenidas:", rows);
        res.json(rows);
    });
});

app.post("/habitaciones", authenticateToken, (req, res) => {
    const { nombre, idVivienda } = req.body;
    if (!nombre || !idVivienda) return res.status(400).json({ error: "nombre e idVivienda requeridos" });
    db.run("INSERT INTO habitacion (nombre, idvivienda) VALUES (?, ?)", [nombre, idVivienda], function(err) {
        if (err) {
            console.error("Error al insertar habitación:", err);
            return res.status(500).json({ error: "Error al crear habitación" });
        }
        // Obtener la habitación recién creada para asegurar que tenemos el ID correcto
        db.get("SELECT * FROM habitacion WHERE nombre = ? AND idvivienda = ? ORDER BY idhabitacion DESC LIMIT 1", [nombre, idVivienda], (getErr, row) => {
            if (getErr || !row) {
                console.error("Error al obtener habitación recién creada:", getErr);
                return res.status(500).json({ error: "Error al obtener la habitación creada" });
            }
            res.json(row);
        });
    });
});

app.delete("/habitaciones/:id", authenticateToken, (req, res) => {
    const id = Number(req.params.id);
    console.log("DELETE habitación solicitado - ID:", id, "Tipo:", typeof id, "IsNaN:", isNaN(id));
    
    if (isNaN(id) || id <= 0) {
        console.warn("ID inválido:", id);
        return res.status(400).json({ error: "ID de habitación inválido" });
    }

    db.get("SELECT * FROM habitacion WHERE idHabitacion = ?", [id], (err, row) => {
        if (err) {
            console.error("Error al buscar habitación:", err);
            return res.status(500).json({ error: "Error al buscar la habitación" });
        }
        if (!row) {
            console.warn("Habitación no encontrada con ID:", id);
            return res.status(404).json({ error: "Habitación no encontrada" });
        }

        console.log("Habitación encontrada:", row);
        
        db.run("UPDATE mecanismos SET idHabitacion = NULL WHERE idHabitacion = ?", [id], (updateErr) => {
            if (updateErr) {
                console.error("Error al desvincular mecanismos:", updateErr);
                return res.status(500).json({ error: "Error al desvincular mecanismos" });
            }
            console.log("Mecanismos desvinculados");

            db.run("UPDATE presupuesto_mecanismo SET idHabitacion = NULL WHERE idHabitacion = ?", [id], (updatePresErr) => {
                if (updatePresErr) {
                    console.error("Error al desvincular presupuestos:", updatePresErr);
                    return res.status(500).json({ error: "Error al desvincular mecanismos del presupuesto" });
                }
                console.log("Presupuestos desvinculados");

                db.run("DELETE FROM habitacion WHERE idHabitacion = ?", [id], function(err) {
                    if (err) {
                        console.error("Error al eliminar habitación:", err);
                        return res.status(500).json({ error: "Error al eliminar habitación" });
                    }
                    console.log("Habitación eliminada exitosamente. Cambios:", this.changes);
                    res.json({ message: "Habitación eliminada", deletedId: id });
                });
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});