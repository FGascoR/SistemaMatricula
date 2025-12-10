const http = require('http');
const { queryPostgres } = require('../config/db_postgres');
const { sendResponse, getBody, corsHeaders } = require('../utils/utils');

function generarInventarioAulas() {
    let aulas = [];
    
    for(let p=2; p<=10; p++) {
        for(let a=1; a<=6; a++) {
            aulas.push({ torre: 'A', piso: p, aula: `A${p.toString().padStart(2,'0')}${a.toString().padStart(2,'0')}` });
        }
    }
    for(let p=2; p<=10; p++) {
        for(let a=1; a<=10; a++) {
            aulas.push({ torre: 'B', piso: p, aula: `B${p.toString().padStart(2,'0')}${a.toString().padStart(2,'0')}` });
        }
    }
    for(let p=5; p<=10; p++) {
        for(let a=1; a<=10; a++) {
            aulas.push({ torre: 'C', piso: p, aula: `C${p.toString().padStart(2,'0')}${a.toString().padStart(2,'0')}` });
        }
    }
    for(let p=2; p<=4; p++) {
        for(let a=1; a<=10; a++) {
            aulas.push({ torre: 'D', piso: p, aula: `D${p.toString().padStart(2,'0')}${a.toString().padStart(2,'0')}` });
        }
    }
    return aulas;
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }
    
    const url = req.url;
    const method = req.method;

    if (url.startsWith('/api/aulas') && method === 'GET') {
        try {
            const params = new URLSearchParams(url.split('?')[1]);
            const torreFiltro = params.get('torre');
            const pisoFiltro = params.get('piso');

            const resultDB = await queryPostgres(`
                SELECT aa.*, h.dia, h.hora_inicio, h.hora_fin, c.nombre as curso_nombre 
                FROM aulas_asignadas aa
                LEFT JOIN horarios h ON aa.horario_id = h.id
                LEFT JOIN cursos c ON h.curso_id = c.id
            `);
            const asignadas = resultDB.rows;

            let todas = generarInventarioAulas();

            if (torreFiltro && torreFiltro !== '0') todas = todas.filter(a => a.torre === torreFiltro);
            if (pisoFiltro && pisoFiltro !== '0') todas = todas.filter(a => a.piso == pisoFiltro);

            
            if (params.get('modo') === 'inventario') {
                sendResponse(res, 200, todas); 
            } else {
                let filtradas = asignadas;
                if (torreFiltro && torreFiltro !== '0') filtradas = filtradas.filter(a => a.torre === torreFiltro);
                if (pisoFiltro && pisoFiltro !== '0') filtradas = filtradas.filter(a => a.piso == pisoFiltro);
                sendResponse(res, 200, filtradas);
            }

        } catch (e) { sendResponse(res, 500, { error: e.message }); }
    }

    else if (url === '/api/asignar-aula' && method === 'POST') {
        try {
            const b = await getBody(req); 

            if (!b.dia_especifico) throw new Error("Debe seleccionar un día o 'TODOS'.");

            const resHorario = await queryPostgres('SELECT * FROM horarios WHERE id = $1', [b.horario_id]);
            if(resHorario.rows.length === 0) throw new Error("Horario no existe");
            const nuevoH = resHorario.rows[0];

            let diasAProcesar = [];
            if (b.dia_especifico === 'TODOS') {
                diasAProcesar = nuevoH.dia.split(',').map(d => d.trim());
            } else {
                diasAProcesar = [b.dia_especifico];
            }

            for (let diaActual of diasAProcesar) {
                
                const checkYaTiene = await queryPostgres(
                    'SELECT * FROM aulas_asignadas WHERE horario_id = $1 AND dia = $2', 
                    [b.horario_id, diaActual]
                );
                if (checkYaTiene.rows.length > 0) {
                    return sendResponse(res, 409, { error: `El curso YA tiene aula asignada para el ${diaActual}.` });
                }

                const ocupaciones = await queryPostgres(
                    `SELECT aa.*, h.hora_inicio, h.hora_fin, h.seccion as sec_ocupante 
                     FROM aulas_asignadas aa 
                     JOIN horarios h ON aa.horario_id = h.id 
                     WHERE aa.aula = $1 AND aa.dia = $2`, 
                    [b.aula, diaActual]
                );

                if(nuevoH.hora_inicio && nuevoH.hora_fin) {
                    const nIni = parseInt(nuevoH.hora_inicio.replace(':',''));
                    const nFin = parseInt(nuevoH.hora_fin.replace(':',''));

                    for (let o of ocupaciones.rows) {
                        const oIni = parseInt(o.hora_inicio.replace(':',''));
                        const oFin = parseInt(o.hora_fin.replace(':',''));
                        
                        if(nIni < oFin && nFin > oIni) {
                            return sendResponse(res, 409, { 
                                error: `¡Conflicto el ${diaActual}! Aula ocupada por Sec. ${o.sec_ocupante} (${o.hora_inicio}-${o.hora_fin})` 
                            });
                        }
                    }
                }
            }

            for (let diaGood of diasAProcesar) {
                await queryPostgres(
                    `INSERT INTO aulas_asignadas (torre, piso, aula, horario_id, seccion, estado, dia) VALUES ($1, $2, $3, $4, $5, 'asignado', $6)`,
                    [b.torre, b.piso, b.aula, b.horario_id, b.seccion, diaGood]
                );
            }

            sendResponse(res, 201, { msg: `Aula asignada exitosamente (${diasAProcesar.length} días).` });

        } catch (e) { console.error(e); sendResponse(res, 500, { error: e.message }); }
    }

    else if (url === '/api/eliminar-asignacion' && method === 'POST') {
        const { id } = await getBody(req);
        await queryPostgres('DELETE FROM aulas_asignadas WHERE id = $1', [id]);
        sendResponse(res, 200, { msg: 'Asignación eliminada' });
    }

    else { sendResponse(res, 404, { error: 'Ruta no encontrada' }); }

}).listen(3007, () => console.log('Srv Aulas (PostgreSQL) corriendo en http://localhost:3007'));