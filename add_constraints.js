const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('Agregando constraints para evitar duplicados...\n');

        // 1. Agregar UNIQUE constraint a usuario_grupo
        console.log('1. Agregando constraint UNIQUE en usuario_grupo...');
        try {
            await pool.query(`
                ALTER TABLE usuario_grupo
                ADD CONSTRAINT uk_usuario_grupo_uniq UNIQUE (idusuario, idgrupo)
            `);
            console.log('   ✅ Constraint UNIQUE agregado a usuario_grupo\n');
        } catch (err) {
            if (err.code === '42P07') {
                console.log('   ℹ️ El constraint ya existe\n');
            } else {
                throw err;
            }
        }

        // 2. Agregar CHECK constraint para evitar usuarios duplicados (si es posible)
        console.log('2. Agregando constraint PRIMARY KEY en usuario...');
        try {
            // Verificar que no hay duplicados primero
            const dup = await pool.query(`
                SELECT email, COUNT(*) as cnt
                FROM usuario
                GROUP BY email
                HAVING COUNT(*) > 1
            `);
            
            if (dup.rows.length === 0) {
                console.log('   ✅ No hay duplicados detectados\n');
            } else {
                console.log('   ⚠️ Se encontraron usuarios duplicados:\n', dup.rows);
            }
        } catch (err) {
            console.error('Error verificando duplicados:', err.message);
        }

        // 3. Crear índices para mejor rendimiento
        console.log('3. Creando índices para mejor rendimiento...');
        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_usuario_grupo_grupo 
                ON usuario_grupo(idgrupo)
            `);
            console.log('   ✅ Índice creado en usuario_grupo(idgrupo)');
        } catch (err) {
            console.error('   Error creando índice:', err.message);
        }

        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_usuario_grupo_usuario 
                ON usuario_grupo(idusuario)
            `);
            console.log('   ✅ Índice creado en usuario_grupo(idusuario)');
        } catch (err) {
            console.error('   Error creando índice:', err.message);
        }

        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_grupo_idowner 
                ON grupo(idowner)
            `);
            console.log('   ✅ Índice creado en grupo(idowner)\n');
        } catch (err) {
            console.error('   Error creando índice:', err.message);
        }

        console.log('✅ Configuración completada!');

        await pool.end();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
})();
