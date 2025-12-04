const http = require('http');
const { connectMongo } = require('../config/db_mongo');
const { sendResponse, corsHeaders } = require('../utils/utils');

http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }
    sendResponse(res, 200, { status: "Servicio de reportes activo" });
}).listen(3005, () => console.log('Srv Reportes (Mongo): 3005'));