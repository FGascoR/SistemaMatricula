const http = require('http');
const { queryPostgres } = require('../config/db_postgres');
const { sendResponse, getBody, corsHeaders } = require('../utils/utils');

const server = http.createServer(async (req, res) => {
    // Manejo de CORS (Pre-flight)
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }
    
    const url = req.url; 
    const method = req.method;

    // ---------------------------------------------------------
    // 1. ADMIN: LISTAR HORARIOS (CON FILTROS)
    // ---------------------------------------------------------
    if (url.startsWith('/api/horarios-todos') && method === 'GET') {
        try {
            const carreraId = new URLSearchParams(url.split('?')[1]).get('carrera');
            let sql = `
                SELECT h.id, h.seccion, h.curso_id, h.profesor_id, h.dia, h.hora_inicio, h.hora_fin, h.vacantes, h.modalidad,
                       h.profesor_nombre, c.nombre as curso_nombre, c.ciclo 
                FROM horarios h
                JOIN cursos c ON h.curso_id = c.id
            `;
            let params = [];
            if (carreraId && carreraId !== '0') {
                sql += ' WHERE c.carrera_id = $1';
                params.push(carreraId);
            }
            sql += ' ORDER BY c.ciclo, h.seccion, h.dia'; 
            const result = await queryPostgres(sql, params);
            sendResponse(res, 200, result.rows);
        } catch (e) { sendResponse(res, 500, { error: e.message }); }
    }

    // ---------------------------------------------------------
    // 2. ADMIN: ASIGNAR O EDITAR HORARIO (POST y PUT)
    // ---------------------------------------------------------
    else if (url === '/api/asignar-horario' && (method === 'POST' || method === 'PUT')) {
        try {
            const b = await getBody(req);
            // b = { id (opcional), curso_id, seccion, profesor_id, dia, inicio, fin ... }

            const esEdicion = (method === 'PUT' && b.id);

            // --- VALIDACIÓN 1: ¿YA EXISTE ESA SECCIÓN PARA ESE CURSO? ---
            // Buscamos si hay otra fila con el mismo curso y sección (excluyendo la propia fila si es edición)
            let sqlDuplicado = 'SELECT id FROM horarios WHERE curso_id = $1 AND seccion = $2';
            let paramsDuplicado = [b.curso_id, b.seccion];
            
            if (esEdicion) {
                sqlDuplicado += ' AND id != $3';
                paramsDuplicado.push(b.id);
            }

            const checkDuplicado = await queryPostgres(sqlDuplicado, paramsDuplicado);
            if (checkDuplicado.rows.length > 0) {
                return sendResponse(res, 409, { error: `La sección ${b.seccion} ya existe para este curso.` });
            }

            // --- VALIDACIÓN 2: CRUCE DE HORARIOS DEL PROFESOR ---
            
            // 1. Obtenemos todos los horarios que tiene este profesor
            const horariosProfe = await queryPostgres('SELECT * FROM horarios WHERE profesor_id = $1', [b.profesor_id]);
            
            // 2. Preparamos datos nuevos
            const nuevosDias = b.dia.split(',').map(d => d.trim());
            const nuevoInicio = parseInt(b.inicio.replace(':', '')); // "08:00" -> 800
            const nuevoFin = parseInt(b.fin.replace(':', ''));

            // 3. Verificamos choques
            for (let h of horariosProfe.rows) {
                // Si estamos editando, ignoramos el horario actual (no choca consigo mismo)
                if (esEdicion && h.id == b.id) continue;

                const diasExistentes = h.dia.split(',').map(d => d.trim());
                const coincidenDias = nuevosDias.some(d => diasExistentes.includes(d));

                if (coincidenDias) {
                    const exInicio = parseInt(h.hora_inicio.substring(0, 5).replace(':', ''));
                    const exFin = parseInt(h.hora_fin.substring(0, 5).replace(':', ''));

                    // Fórmula de intersección de rangos
                    if (nuevoInicio < exFin && nuevoFin > exInicio) {
                        return sendResponse(res, 409, { 
                            error: `CRUCE: El profesor ya dicta el ${h.dia} (${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)})` 
                        });
                    }
                }
            }

            // --- PASO 3: GUARDAR EN BASE DE DATOS ---
            if (esEdicion) {
                // UPDATE
                await queryPostgres(
                    `UPDATE horarios SET 
                        curso_id=$1, seccion=$2, profesor_id=$3, profesor_nombre=$4, 
                        dia=$5, hora_inicio=$6, hora_fin=$7, vacantes=$8, modalidad=$9 
                     WHERE id=$10`,
                    [b.curso_id, b.seccion, b.profesor_id, b.profesor_nombre, b.dia, b.inicio, b.fin, b.vacantes, b.modalidad, b.id]
                );
                sendResponse(res, 200, { msg: 'Horario actualizado correctamente' });
            } else {
                // INSERT
                await queryPostgres(
                    `INSERT INTO horarios 
                        (curso_id, seccion, profesor_id, profesor_nombre, dia, hora_inicio, hora_fin, vacantes, modalidad) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [b.curso_id, b.seccion, b.profesor_id, b.profesor_nombre, b.dia, b.inicio, b.fin, b.vacantes, b.modalidad]
                );
                sendResponse(res, 201, { msg: 'Horario creado correctamente' });
            }

        } catch (e) { 
            console.error(e); 
            sendResponse(res, 500, { error: e.message }); 
        }
    }

    // ---------------------------------------------------------
    // 3. ADMIN: ELIMINAR HORARIO
    // ---------------------------------------------------------
    else if (url === '/api/eliminar-horario' && method === 'POST') {
        try {
            const { id } = await getBody(req);
            await queryPostgres('DELETE FROM horarios WHERE id = $1', [id]);
            sendResponse(res, 200, { msg: 'Horario eliminado' });
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: 'Error al eliminar' });
        }
    }

    // ---------------------------------------------------------
    // 4. ALUMNO: VER HORARIOS DE UN CURSO
    // ---------------------------------------------------------
    else if (url === '/api/horarios' && method === 'POST') {
        const { curso_id } = await getBody(req);
        const result = await queryPostgres('SELECT * FROM horarios WHERE curso_id = $1 ORDER BY seccion', [curso_id]);
        sendResponse(res, 200, result.rows);
    }

    // ---------------------------------------------------------
    // 5. SISTEMA: RESTAR VACANTE (AL MATRICULARSE)
    // ---------------------------------------------------------
    else if (url === '/api/restar-vacante' && method === 'PUT') {
        const { horario_id } = await getBody(req); // Ojo: en panel.js mandas horario_id
        await queryPostgres('UPDATE horarios SET vacantes = vacantes - 1 WHERE id = $1', [horario_id]);
        sendResponse(res, 200, { msg: 'Ok' });
    }

    // ---------------------------------------------------------
    // 6. PROFESOR: VER MIS HORARIOS
    // ---------------------------------------------------------
    else if (url.startsWith('/api/mis-horarios-profe') && method === 'GET') {
        const pid = new URLSearchParams(url.split('?')[1]).get('id');
        const sql = `SELECT h.*, c.nombre as curso_nombre, c.codigo FROM horarios h JOIN cursos c ON h.curso_id = c.id WHERE h.profesor_id = $1`;
        const result = await queryPostgres(sql, [pid]);
        sendResponse(res, 200, result.rows);
    }
    
    else { sendResponse(res, 404, { error: 'Ruta no encontrada' }); }

});

server.listen(3003, () => console.log('🚀 Srv Horarios corriendo en puerto 3003'));