const http = require('http');
const bcrypt = require('bcryptjs'); 
const { sendResponse, getBody, corsHeaders, queryMySQL } = require('../utils/utils');

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

    if (req.url === '/api/login' && req.method === 'POST') {
        try {
            const { correo, contrasena } = await getBody(req); 
            
            const users = await queryMySQL('SELECT * FROM usuarios WHERE correo = ?', [correo]);

            if (users.length === 0) {
                return sendResponse(res, 401, { error: 'Usuario no encontrado' });
            }

            const usuario = users[0];

            const contrasenaEsCorrecta = await bcrypt.compare(contrasena, usuario.contrasena);

            if (contrasenaEsCorrecta) {
                sendResponse(res, 200, { 
                    success: true, 
                    user: { 
                        id: usuario.id, 
                        nombre: usuario.nombre,
                        ciclo: usuario.ciclo 
                    } 
                });
            } else {
                sendResponse(res, 401, { error: 'Contraseña incorrecta' });
            }

        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: 'Error interno' });
        }
    } 

    else if (req.url === '/api/register' && req.method === 'POST') {
        try {
            const { correo, contrasena, nombre, ciclo } = await getBody(req);

            const contrasenaHash = await bcrypt.hash(contrasena, 10);

            await queryMySQL(
                'INSERT INTO usuarios (correo, contrasena, nombre, ciclo) VALUES (?, ?, ?, ?)', 
                [correo, contrasenaHash, nombre, ciclo || 1]
            );

            sendResponse(res, 201, { success: true, msg: "Usuario creado" });
        } catch (e) {
            console.error(e);
            sendResponse(res, 500, { error: 'Error al registrar (posible duplicado)' });
        }
    }
    
    else {
        sendResponse(res, 404, { error: 'Ruta no encontrada' });
    }
});

server.listen(3001, () => console.log('🔒 Srv Auth (MySQL) corriendo en 3001'));