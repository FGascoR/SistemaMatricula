const http = require('http');
const { queryPostgres } = require('../config/db_postgres');
const { sendResponse, getBody, corsHeaders } = require('../utils/utils');

http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

    if (req.url === '/api/horarios' && req.method === 'POST') {
        const { curso_id } = await getBody(req);
        const result = await queryPostgres('SELECT * FROM horarios WHERE curso_id = $1', [curso_id]);
        sendResponse(res, 200, result.rows);
    }

    else if (req.url === '/api/restar-vacante' && req.method === 'PUT') {
        try {
            const { horario_id } = await getBody(req);
            await queryPostgres('UPDATE horarios SET vacantes = vacantes - 1 WHERE id = $1', [horario_id]);
            sendResponse(res, 200, { msg: 'Vacante actualizada' });
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: 'Error actualizando vacantes' });
        }
    }
}).listen(3003, () => console.log('Srv Horarios (PG): 3003'));