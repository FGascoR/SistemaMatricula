const http = require('http');
const { queryPostgres } = require('../config/db_postgres');
const { sendResponse, corsHeaders, getBody } = require('../utils/utils');

http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

    const url = req.url;
    const method = req.method;

    if (url.startsWith('/api/cursos') && method === 'GET') {
        try {
            const params = new URLSearchParams(url.split('?')[1]);
            const carrera = params.get('carrera');
            const ciclo = params.get('ciclo');

            let query = 'SELECT * FROM cursos WHERE 1=1';
            let args = [];
            let i = 1;

            if (carrera && carrera !== '0') { query += ` AND carrera_id = $${i++}`; args.push(carrera); }
            if (ciclo && ciclo !== '0') { query += ` AND ciclo = $${i++}`; args.push(ciclo); }
            
            query += ' ORDER BY ciclo, nombre';

            const result = await queryPostgres(query, args);
            sendResponse(res, 200, result.rows);
        } catch (e) { 
            console.error(e);
            sendResponse(res, 500, { error: e.message }); 
        }
    }

    else if (url === '/api/cursos' && method === 'POST') {
        try {
            const b = await getBody(req);
            if(!b.codigo || !b.nombre || !b.carrera_id) throw new Error("Faltan datos obligatorios");

            const sql = `INSERT INTO cursos (codigo, nombre, ciclo, creditos, horas, carrera_id) 
                         VALUES ($1, $2, $3, $4, $5, $6)`;
            
            await queryPostgres(sql, [b.codigo, b.nombre, b.ciclo, b.creditos, b.horas, b.carrera_id]);
            sendResponse(res, 201, { msg: 'Curso creado correctamente' });
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: e.message });
        }
    }

    else {
        sendResponse(res, 404, { error: 'Ruta no encontrada' });
    }

}).listen(3002, () => console.log('Srv Cursos (PostgreSQL) corriendo en http://localhost:3002'));