const http = require('http');
const bcrypt = require('bcryptjs'); 
const { sendResponse, getBody, corsHeaders, queryMySQL } = require('../utils/utils');

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }
    
    const url = req.url; 
    const method = req.method;

    if (url === '/api/login' && method === 'POST') {
        try {
            const { correo, contrasena } = await getBody(req);
            let user = null;
            let table = '';

            let results = await queryMySQL('SELECT * FROM admins WHERE correo = ?', [correo]);
            if (results.length > 0) { user = results[0]; table = 'admin'; }
            else {
                results = await queryMySQL('SELECT * FROM profesores WHERE correo = ?', [correo]);
                if (results.length > 0) { user = results[0]; table = 'profesor'; }
                else {
                    results = await queryMySQL('SELECT * FROM alumnos WHERE correo = ?', [correo]);
                    if (results.length > 0) { user = results[0]; table = 'alumno'; }
                }
            }

            if (!user) return sendResponse(res, 401, { error: 'Usuario no encontrado' });

            const passOk = await bcrypt.compare(contrasena, user.contrasena);
            if (!passOk) return sendResponse(res, 401, { error: 'Contraseña incorrecta' });

            sendResponse(res, 200, { 
                success: true, 
                user: { 
                    id: user.id, 
                    nombre: user.nombre, 
                    rol: table, 
                    ciclo: user.ciclo || 0,       
                    carrera_id: user.carrera_id || 0 
                } 
            });

        } catch (e) { console.error(e); sendResponse(res, 500, { error: e.message }); }
    } 

    else if (url.startsWith('/api/usuarios') && method === 'GET') {
        const params = new URLSearchParams(url.split('?')[1]);
        const rol = params.get('rol'); 
        const carrera = params.get('carrera');
        const nombre = params.get('nombre');

        let sql = '';
        let args = [];

        if (rol === 'alumno') {
            sql = `SELECT a.id, a.nombre, a.correo, a.ciclo, a.carrera_id, c.nombre as carrera 
                   FROM alumnos a 
                   LEFT JOIN carreras c ON a.carrera_id = c.id WHERE 1=1`;
            
            if (carrera && carrera !== '0') { sql += ' AND a.carrera_id = ?'; args.push(carrera); }
            if (nombre) { sql += ' AND a.nombre LIKE ?'; args.push(`%${nombre}%`); }
        } 
        else if (rol === 'profesor') {
            sql = `SELECT p.id, p.nombre, p.correo, p.carrera_id, c.nombre as carrera 
                   FROM profesores p 
                   LEFT JOIN carreras c ON p.carrera_id = c.id WHERE 1=1`;
            
            if (carrera && carrera !== '0') { sql += ' AND p.carrera_id = ?'; args.push(carrera); }
        }

        const data = await queryMySQL(sql, args);
        sendResponse(res, 200, data);
    }

    else if (url === '/api/usuarios' && method === 'POST') {
        try {
            const b = await getBody(req); 
            const hash = await bcrypt.hash(b.contrasena, 10);

            if (b.rol === 'profesor') {
                await queryMySQL('INSERT INTO profesores (nombre, correo, contrasena, carrera_id) VALUES (?,?,?,?)', 
                    [b.nombre, b.correo, hash, b.carrera_id || 1]);
            } else if (b.rol === 'alumno') {
                await queryMySQL('INSERT INTO alumnos (nombre, correo, contrasena, ciclo, carrera_id) VALUES (?,?,?,?,?)', 
                    [b.nombre, b.correo, hash, b.ciclo || 1, b.carrera_id || 1]);
            }
            sendResponse(res, 201, { msg: 'Usuario creado' });
        } catch (e) { console.error(e); sendResponse(res, 500, { error: 'Error (correo duplicado)' }); }
    }

    else if (url === '/api/carreras' && method === 'GET') {
        const data = await queryMySQL('SELECT * FROM carreras');
        sendResponse(res, 200, data);
    }
    
    else { sendResponse(res, 404, { error: 'Ruta no encontrada' }); }
});

server.listen(3001, () => console.log('Srv Login (MySQL) corriendo en http://localhost:3001'));