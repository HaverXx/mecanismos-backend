const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Simular mapKeys
const keyMap = {
    idinvitacion: "idInvitacion",
    nombregrupo: "nombreGrupo",
    nombreremitente: "nombreRemitente",
    emaildestinatario: "emailDestinatario",
    idremitente: "idRemitente",
    idgrupo: "idGrupo",
    estado: "estado"
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

(async () => {
    try {
        console.log('=== PROBANDO MAPEO DE INVITACIONES ===\n');

        const res = await pool.query(`
            SELECT i.*, g.nombre as nombregrupo, u.fullname as nombreremitente
            FROM invitacion i
            JOIN grupo g ON i.idgrupo = g.idgrupo
            JOIN usuario u ON i.idremitente = u.idusuario
            WHERE i.estado = 'PENDIENTE'
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log('No hay invitaciones pendientes');
        } else {
            console.log('Antes de mapKeys:');
            console.log(JSON.stringify(res.rows[0], null, 2));
            
            console.log('\nDespués de mapKeys:');
            const mapped = mapKeys(res.rows[0]);
            console.log(JSON.stringify(mapped, null, 2));

            // Verificar que idInvitacion existe
            console.log('\nVerificaciones:');
            console.log(`✅ idInvitacion: ${mapped.idInvitacion}`);
            console.log(`✅ nombreGrupo: ${mapped.nombreGrupo}`);
            console.log(`✅ nombreRemitente: ${mapped.nombreRemitente}`);
        }

        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
