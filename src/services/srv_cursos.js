const http = require('http');
const { queryPostgres } = require('../config/db_postgres');
const { sendResponse, corsHeaders } = require('../utils/utils');

http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

    if (req.url.startsWith('/api/cursos') && req.method === 'GET') {
        try {
            const urlParams = new URLSearchParams(req.url.split('?')[1]);
            const ciclo = urlParams.get('ciclo');

            let query = 'SELECT * FROM cursos';
            let params = [];

            if (ciclo) {
                query += ' WHERE ciclo = $1 ORDER BY nombre';
                params.push(ciclo);
            } else {
                query += ' ORDER BY ciclo, nombre';
            }

            const result = await queryPostgres(query, params);
            sendResponse(res, 200, result.rows);
        } catch (e) { 
            console.error(e);
            sendResponse(res, 500, { error: e.message }); 
        }
    }
}).listen(3002, () => console.log('Srv Cursos (PG): 3002'));