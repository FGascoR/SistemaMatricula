const http = require('http');
const { connectMongo } = require('../config/db_mongo');
const { sendResponse, getBody, corsHeaders } = require('../utils/utils');

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

    const db = await connectMongo();
    const collection = db.collection('pagos');

    const url = req.url;
    const method = req.method;

    if (url.startsWith('/api/estado-cuenta') && method === 'GET') {
        try {
            const params = new URLSearchParams(url.split('?')[1]);
            const alumnoId = parseInt(params.get('id'));

            const pagosRealizados = await collection.find({ alumno_id: alumnoId }).toArray();
            
            const matriculaPagada = pagosRealizados.some(p => p.concepto === 'Matrícula 2025-I');

            const cuotasBase = [
                { id: 1, concepto: 'Cuota 1 - Marzo', monto: 550.00, vencimiento: '2025-03-30' },
                { id: 2, concepto: 'Cuota 2 - Abril', monto: 550.00, vencimiento: '2025-04-30' },
                { id: 3, concepto: 'Cuota 3 - Mayo', monto: 550.00, vencimiento: '2025-05-30' },
                { id: 4, concepto: 'Cuota 4 - Junio', monto: 550.00, vencimiento: '2025-06-30' },
                { id: 5, concepto: 'Cuota 5 - Julio', monto: 550.00, vencimiento: '2025-07-30' }
            ];

            const estadoCuotas = cuotasBase.map(c => {
                const pagado = pagosRealizados.find(p => p.concepto === c.concepto);
                return {
                    ...c,
                    estado: pagado ? 'Pagado' : 'Pendiente',
                    fecha_pago: pagado ? pagado.fecha : null
                };
            });

            sendResponse(res, 200, {
                matricula_pagada: matriculaPagada,
                historial: pagosRealizados,
                cuotas: estadoCuotas
            });

        } catch (e) { console.error(e); sendResponse(res, 500, { error: e.message }); }
    }

    else if (url === '/api/pagar' && method === 'POST') {
        try {
            const body = await getBody(req);
            
            const nuevoPago = {
                alumno_id: body.alumno_id,
                alumno_nombre: body.alumno_nombre,
                concepto: body.concepto,
                monto: body.monto,
                metodo: body.metodo || 'Tarjeta Crédito/Débito',
                fecha: new Date(),
                estado: 'Aprobado'
            };

            await collection.insertOne(nuevoPago);
            sendResponse(res, 201, { msg: 'Pago procesado exitosamente' });

        } catch (e) { console.error(e); sendResponse(res, 500, { error: e.message }); }
    }

    else if (url === '/api/pagos-todos' && method === 'GET') {
        try {
            const todos = await collection.find({}).toArray();
            sendResponse(res, 200, todos);
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: e.message });
        }
    }

    else { sendResponse(res, 404, { error: 'Ruta no encontrada' }); }

});

server.listen(3008, () => console.log('Srv Pagos (Mongo) corriendo en http://localhost:3008'));