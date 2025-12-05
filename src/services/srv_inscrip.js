const http = require('http');
const { connectMongo } = require('../config/db_mongo');
const { sendResponse, getBody, corsHeaders } = require('../utils/utils');

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

    const db = await connectMongo();
    const collection = db.collection('matriculas_guardadas');

    // --- GUARDAR MATRÍCULA ---
    if (req.url === '/api/matricular' && req.method === 'POST') {
        try {
            const body = await getBody(req);
            
            console.log(`💾 Guardando matrícula para Usuario ID: ${body.usuario_id}`);

            await collection.updateOne(
                { usuario_id: body.usuario_id }, 
                { $set: { 
                    alumno: body.alumno_nombre,
                    carrera_id: body.carrera_id || 0, // NUEVO: Para filtros admin
                    ciclo: body.ciclo || 0,           // NUEVO: Para filtros admin
                    cursos: body.cursos,
                    total_creditos: body.total_creditos,
                    ultima_actualizacion: new Date()
                }},
                { upsert: true }
            );
            
            sendResponse(res, 200, { msg: 'Matrícula guardada correctamente en la Nube.' });
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: e.message });
        }
    }

    // --- VER MI MATRÍCULA (ALUMNO) ---
    else if (req.url.startsWith('/api/mi-matricula') && req.method === 'GET') {
        try {
            const urlParams = new URLSearchParams(req.url.split('?')[1]);
            const userId = parseInt(urlParams.get('id'));

            console.log(`🔎 Buscando matrícula guardada para Usuario ID: ${userId}`);

            const ficha = await collection.findOne({ usuario_id: userId });
            
            if (ficha) {
                sendResponse(res, 200, { existe: true, datos: ficha });
            } else {
                sendResponse(res, 200, { existe: false, datos: [] });
            }
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: 'Error al recuperar datos' });
        }
    }

    // --- NUEVO: LISTAR TODAS (ADMIN) ---
    else if (req.url === '/api/matriculas-todas' && req.method === 'GET') {
        try {
            // Obtenemos todas y ordenamos por fecha de actualización
            const todas = await collection.find({}).sort({ ultima_actualizacion: -1 }).toArray();
            sendResponse(res, 200, todas);
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: 'Error al listar matrículas' });
        }
    }

    else {
        sendResponse(res, 404, { error: 'Ruta no encontrada' });
    }
});

server.listen(3004, () => console.log('Srv Inscripción (Mongo): 3004'));