const http = require('http');
const { connectMongo } = require('../config/db_mongo');
const { queryPostgres } = require('../config/db_postgres'); // Importamos Postgres para consultar cursos
const { sendResponse, getBody, corsHeaders } = require('../utils/utils');
const { ObjectId } = require('mongodb');

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

    const db = await connectMongo();
    const collection = db.collection('solicitudes');

    const url = req.url;
    const method = req.method;

    // --- 1. CREAR SOLICITUD (ALUMNO) ---
    if (url === '/api/solicitudes' && method === 'POST') {
        try {
            const body = await getBody(req);
            // body esperado: { curso_id, curso_nombre, ciclo, carrera_id (opcional) }
            
            // LÓGICA DE CORRECCIÓN: Obtener la carrera real desde Postgres
            let carreraRealId = body.carrera_id;
            
            if (!carreraRealId || carreraRealId === 0) {
                try {
                    // Consultamos el curso en Postgres para saber su carrera
                    const cursoData = await queryPostgres('SELECT carrera_id FROM cursos WHERE id = $1', [body.curso_id]);
                    if (cursoData.rows.length > 0) {
                        carreraRealId = cursoData.rows[0].carrera_id;
                        console.log(`✅ Carrera corregida para curso ${body.curso_id}: ${carreraRealId}`);
                    }
                } catch (pgError) {
                    console.error("Error consultando carrera en PG:", pgError);
                    // Si falla, nos quedamos con lo que vino o 0
                }
            }

            const nuevaSolicitud = {
                // usuario_id y alumno_nombre ELIMINADOS COMPLETAMENTE para anonimato
                curso_id: body.curso_id,
                curso_nombre: body.curso_nombre,
                ciclo: body.ciclo,
                carrera_id: carreraRealId, // Usamos el ID verificado
                fecha_solicitud: new Date(),
                estado: 'pendiente' 
            };

            await collection.insertOne(nuevaSolicitud);
            sendResponse(res, 201, { msg: 'Solicitud anónima enviada correctamente' });
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: e.message });
        }
    }

    // --- 2. LISTAR SOLICITUDES (ADMIN) ---
    else if (url.startsWith('/api/solicitudes') && method === 'GET') {
        try {
            // Ordenar por fecha descendente (más recientes primero)
            const solicitudes = await collection.find({}).sort({ fecha_solicitud: -1 }).toArray();
            sendResponse(res, 200, solicitudes);
        } catch (e) {
            sendResponse(res, 500, { error: e.message });
        }
    }

    // --- 3. ACEPTAR SOLICITUD (ADMIN) ---
    else if (url === '/api/solicitudes/aceptar' && method === 'PUT') {
        try {
            const { id } = await getBody(req);
            await collection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { estado: 'aceptada' } }
            );
            sendResponse(res, 200, { msg: 'Solicitud marcada como aceptada' });
        } catch (e) {
            sendResponse(res, 500, { error: e.message });
        }
    }

    else { sendResponse(res, 404, { error: 'Ruta no encontrada' }); }
});

server.listen(3006, () => console.log('📩 Srv Solicitudes (Mongo - Anónimo + Fix Carrera): 3006'));