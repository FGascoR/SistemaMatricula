const API_AUTH = 'http://localhost:3001/api'; 
const API_CUR = 'http://localhost:3002/api'; 
const API_HOR = 'http://localhost:3003/api';
const API_INS = 'http://localhost:3004/api'; 
const API_SOL = 'http://localhost:3006/api/solicitudes'; 

const modalProf = new bootstrap.Modal(document.getElementById('modalNuevoProfe'));
const modalAsig = new bootstrap.Modal(document.getElementById('modalAsignacion'));
const modalConfirm = new bootstrap.Modal(document.getElementById('modalConfirm')); 
const modalManual = new bootstrap.Modal(document.getElementById('modalMatriculaManual'));

const toastEl = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastEl);

let idEliminarTemp = null; 
let solicitudActualId = null; 

// Variables para Matrícula Manual
let alumnoSeleccionado = null; 
let cursosManualTemp = []; 

// --- TOAST FUNCTION ---
function mostrarToast(msg, bgClass = 'bg-primary') {
    document.getElementById('toast-message').innerText = msg;
    toastEl.className = `toast align-items-center text-white border-0 ${bgClass}`;
    toast.show();
}

document.addEventListener('DOMContentLoaded', async () => { 
    await cargarCarreras(); 
    ver('alumnos'); 

    // Búsqueda en tiempo real
    const inputBusq = document.getElementById('busqNombreAlu');
    if(inputBusq) {
        inputBusq.addEventListener('input', () => {
            cargarAlumnosManual(); 
        });
    }
    
    // Filtros reactivos
    const filtroCarrera = document.getElementById('busqCarreraAlu');
    if(filtroCarrera) filtroCarrera.addEventListener('change', cargarAlumnosManual);
    
    const filtroCiclo = document.getElementById('busqCicloAlu');
    if(filtroCiclo) filtroCiclo.addEventListener('change', cargarAlumnosManual);
});

function ver(id) {
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    document.getElementById('link-'+id).classList.add('active');
    document.querySelectorAll('.section-view').forEach(s => s.classList.remove('active'));
    document.getElementById('view-'+id).classList.add('active');
    
    if(id === 'profesores') cargarProfesores();
    if(id === 'cursos') cargarCursosAdmin();
    if(id === 'asignacion') cargarTablaHorarios();
    if(id === 'solicitudes') cargarSolicitudes();
    if(id === 'matriculas') cargarMatriculasAdmin();
}

async function cargarCarreras() {
    const res = await fetch(API_AUTH + '/carreras'); const data = await res.json();
    const fill = (id) => { 
        const s = document.getElementById(id); 
        if(!s) return;
        s.innerHTML='<option value="0">Seleccione...</option>'; 
        data.forEach(c=>s.innerHTML+=`<option value="${c.id}">${c.nombre}</option>`); 
    };
    fill('filtroCarreraAlu'); fill('filtroCarreraProf'); fill('filtroCarreraCur'); 
    fill('asigCarrera'); fill('profCarreraSelect'); fill('filtroCarreraHor');
    fill('filtroCarreraMat'); fill('busqCarreraAlu');
}

// --- ALUMNOS Y PROFESORES ---
async function cargarAlumnos() {
    const cid = document.getElementById('filtroCarreraAlu').value; const tb = document.getElementById('tabla-alumnos'); tb.innerHTML='';
    if(cid==0) { tb.innerHTML='<tr><td colspan="4" class="text-center">Seleccione carrera</td></tr>'; return; }
    const res = await fetch(`${API_AUTH}/usuarios?rol=alumno&carrera=${cid}`); const data = await res.json();
    if(data.length===0) tb.innerHTML='<tr><td colspan="4" class="text-center">Sin alumnos</td></tr>';
    data.forEach(u => tb.innerHTML+=`<tr><td>${u.nombre}</td><td>${u.correo}</td><td>${u.ciclo}</td><td>${u.carrera||'-'}</td></tr>`);
}
async function cargarProfesores() {
    const cid = document.getElementById('filtroCarreraProf').value; const tb = document.getElementById('tabla-profesores'); tb.innerHTML='';
    if(cid==0) { tb.innerHTML='<tr><td colspan="3" class="text-center">Seleccione carrera</td></tr>'; return; }
    const res = await fetch(`${API_AUTH}/usuarios?rol=profesor&carrera=${cid}`); const data = await res.json();
    if(data.length===0) tb.innerHTML='<tr><td colspan="3" class="text-center">Sin profesores</td></tr>';
    data.forEach(u => tb.innerHTML+=`<tr><td>${u.nombre}</td><td>${u.correo}</td><td>${u.carrera||'General'}</td></tr>`);
}
async function crearProfesor() {
    const b = { nombre: document.getElementById('profNom').value, correo: document.getElementById('profEmail').value, contrasena: document.getElementById('profPass').value, carrera_id: document.getElementById('profCarreraSelect').value, rol: 'profesor' };
    const res = await fetch(API_AUTH+'/usuarios', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b)});
    if(res.ok) { mostrarToast('✅ Profesor creado', 'bg-success'); modalProf.hide(); cargarProfesores(); }
    else { mostrarToast('⛔ Error al crear', 'bg-danger'); }
}

// --- CURSOS ---
async function cargarCursosAdmin() {
    const cid = document.getElementById('filtroCarreraCur').value; const ciclo = document.getElementById('filtroCicloCur').value; const tb = document.getElementById('tabla-cursos'); tb.innerHTML='';
    if(cid==0) { tb.innerHTML='<tr><td colspan="4" class="text-center">Seleccione carrera</td></tr>'; return; }
    const res = await fetch(`${API_CUR}/cursos?carrera=${cid}&ciclo=${ciclo}`); const data = await res.json();
    if(data.length===0) tb.innerHTML='<tr><td colspan="4" class="text-center">Sin cursos</td></tr>';
    data.forEach(c => tb.innerHTML+=`<tr><td>${c.codigo}</td><td>${c.nombre}</td><td>${c.ciclo}</td><td>${c.creditos}</td></tr>`);
}

// --- ASIGNACIÓN DE HORARIOS ---
function abrirModalHorario() {
    document.getElementById('idHorarioEditar').value = ''; 
    document.getElementById('modalTitleHorario').innerText = "Asignar Nuevo Horario";
    
    const selCarrera = document.getElementById('asigCarrera');
    selCarrera.value = 0; selCarrera.disabled = false;
    
    document.getElementById('asigCurso').innerHTML = '<option>Esperando...</option>'; document.getElementById('asigCurso').disabled = true;
    document.getElementById('asigProf').innerHTML = '<option>Esperando...</option>'; document.getElementById('asigProf').disabled = true;
    
    document.getElementById('asigSec').value = '';
    document.getElementById('asigVac').value = 30;
    document.getElementById('asigIni').value = '';
    document.getElementById('asigFin').value = '';
    document.querySelectorAll('.chk-dia').forEach(cb => cb.checked = false);
    
    solicitudActualId = null; 
    modalAsig.show();
}

async function editarHorario(hString) {
    const h = JSON.parse(decodeURIComponent(hString));
    document.getElementById('idHorarioEditar').value = h.id; 
    document.getElementById('modalTitleHorario').innerText = "Editar Horario";
    
    const selCarrera = document.getElementById('asigCarrera');
    if (h.carrera_id) selCarrera.value = h.carrera_id; 
    selCarrera.disabled = false; 

    await cargarDatosAsignacion(); 

    document.getElementById('asigCurso').value = h.curso_id;
    document.getElementById('asigProf').value = h.profesor_id;
    document.getElementById('asigSec').value = h.seccion;
    document.getElementById('asigVac').value = h.vacantes;
    document.getElementById('asigIni').value = h.hora_inicio || ''; 
    document.getElementById('asigFin').value = h.hora_fin || '';    
    document.getElementById('asigMod').value = h.modalidad || 'Presencial';
    
    const dias = h.dia ? h.dia.split(',').map(d=>d.trim()) : [];
    document.querySelectorAll('.chk-dia').forEach(cb => cb.checked = dias.includes(cb.value));

    mostrarToast("⚠️ Verifica la carrera para cargar dependencias.", "bg-info");
    solicitudActualId = null; 
    modalAsig.show();
}

// --- MATRÍCULAS (LISTADO CORREGIDO CON CRUCE DE DATOS) ---
async function cargarMatriculasAdmin() {
    const tb = document.getElementById('tabla-matriculas-admin');
    tb.innerHTML = '<tr><td colspan="5" class="text-center">Cargando datos completos...</td></tr>';
    
    try {
        // 1. CARGAMOS MATRÍCULAS (Mongo) Y ALUMNOS (MySQL) EN PARALELO
        const [resMat, resAlu] = await Promise.all([
            fetch(`${API_INS}/matriculas-todas`),
            fetch(`${API_AUTH}/usuarios?rol=alumno`) // Traemos todos para cruzar datos
        ]);
        
        const matriculas = await resMat.json();
        const alumnos = await resAlu.json();

        // 2. MAPEAR ALUMNOS POR ID PARA ACCESO RÁPIDO
        const mapAlumnos = {};
        alumnos.forEach(a => mapAlumnos[a.id] = a);
        
        const fCarrera = document.getElementById('filtroCarreraMat').value;
        const fCiclo = document.getElementById('filtroCicloMat').value;

        tb.innerHTML = '';
        
        const filtrados = matriculas.filter(m => {
            // EXTRAEMOS DATOS DEL ALUMNO SI EXISTE EN MYSQL
            const datosAlumno = mapAlumnos[m.usuario_id] || {};
            
            // Usamos el dato de MySQL (más fiable) o el de Mongo como fallback
            const idCarreraReal = datosAlumno.carrera_id || m.carrera_id || 0;
            const nombreCarreraReal = datosAlumno.carrera || 'Sin Asignar';
            const cicloReal = datosAlumno.ciclo || m.ciclo || 0;

            // Filtros
            let pasaCarrera = (fCarrera === '0') || (idCarreraReal == fCarrera);
            let pasaCiclo = (fCiclo === '0') || (cicloReal == fCiclo);
            
            // GUARDAMOS DATOS CRUZADOS EN EL OBJETO PARA PINTARLOS LUEGO
            m._carreraNombre = nombreCarreraReal;
            m._cicloReal = cicloReal;

            return pasaCarrera && pasaCiclo;
        });

        if (filtrados.length === 0) {
            tb.innerHTML = '<tr><td colspan="5" class="text-center">No se encontraron matrículas con los filtros actuales.</td></tr>';
            return;
        }

        filtrados.forEach(m => {
            const fecha = m.ultima_actualizacion ? new Date(m.ultima_actualizacion).toLocaleString() : '-';
            
            tb.innerHTML += `
            <tr>
                <td>
                    <div class="fw-bold">${m.alumno || 'Desconocido'}</div>
                    <small class="text-muted">Ciclo ${m._cicloReal}</small>
                </td>
                <td>${m._carreraNombre}</td>
                <td><span class="badge bg-secondary">${m.cursos.length} Cursos</span></td>
                <td>${m.total_creditos}</td>
                <td>${fecha}</td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tb.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar datos.</td></tr>';
    }
}

// --- MATRÍCULA MANUAL (WIZARD) ---
function abrirModalMatriculaManual() {
    alumnoSeleccionado = null;
    cursosManualTemp = [];
    document.getElementById('busqNombreAlu').value = '';
    document.getElementById('busqCarreraAlu').value = '0'; 
    document.getElementById('busqCicloAlu').value = '0'; 
    document.getElementById('lista-alumnos-manual').innerHTML = '';
    
    volverPaso1();
    modalManual.show();
    cargarAlumnosManual();
}

function volverPaso1() {
    document.getElementById('step-select-student').style.display = 'block';
    document.getElementById('step-select-courses').style.display = 'none';
}

async function cargarAlumnosManual() {
    const nombre = document.getElementById('busqNombreAlu').value;
    const carrera = document.getElementById('busqCarreraAlu').value;
    const ciclo = document.getElementById('busqCicloAlu').value;
    const tb = document.getElementById('lista-alumnos-manual');
    
    if(tb.innerHTML === '') {
        tb.innerHTML = '<tr><td colspan="4" class="text-center">Cargando lista...</td></tr>';
    }

    let url = `${API_AUTH}/usuarios?rol=alumno`;
    if(carrera !== '0') url += `&carrera=${carrera}`;
    if(nombre.trim() !== '') url += `&nombre=${encodeURIComponent(nombre)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        
        const filtrados = ciclo === '0' ? data : data.filter(u => u.ciclo == ciclo);
        
        tb.innerHTML = '';
        if(filtrados.length === 0) {
            tb.innerHTML = '<tr><td colspan="4" class="text-center">No se encontraron alumnos.</td></tr>';
            return;
        }

        filtrados.forEach(u => {
            let nombreCarrera = u.carrera || 'No asignada';
            const uStr = encodeURIComponent(JSON.stringify(u));
            
            tb.innerHTML += `
            <tr>
                <td class="fw-bold">${u.nombre}</td>
                <td>${nombreCarrera}</td>
                <td>${u.ciclo}</td>
                <td>
                    <button onclick="seleccionarAlumnoManual('${uStr}')" class="btn btn-sm btn-black">
                        Seleccionar <i class="fa fa-arrow-right"></i>
                    </button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tb.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar alumnos.</td></tr>';
    }
}

async function seleccionarAlumnoManual(uStr) {
    alumnoSeleccionado = JSON.parse(decodeURIComponent(uStr));
    
    try {
        const resMat = await fetch(`${API_INS}/mi-matricula?id=${alumnoSeleccionado.id}`);
        const dataMat = await resMat.json();
        
        if (dataMat.existe) {
            mostrarToast(`⚠️ ADVERTENCIA: ${alumnoSeleccionado.nombre} ya tiene una matrícula registrada.`, "bg-warning");
        }
    } catch(e) { console.error("Error verificando matricula", e); }

    document.getElementById('lblAlumnoNombre').innerText = alumnoSeleccionado.nombre;
    document.getElementById('step-select-student').style.display = 'none';
    document.getElementById('step-select-courses').style.display = 'block';

    const container = document.getElementById('manual-cursos-container');
    container.innerHTML = '';
    document.getElementById('manual-cursos-loading').style.display = 'block';
    
    cursosManualTemp = [];
    actualizarCarritoManual();

    const res = await fetch(`${API_CUR}/cursos?carrera=${alumnoSeleccionado.carrera_id || 0}&ciclo=${alumnoSeleccionado.ciclo || 1}`);
    const cursos = await res.json();
    document.getElementById('manual-cursos-loading').style.display = 'none';

    if(cursos.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No hay cursos disponibles para este alumno.</div>';
        return;
    }

    for (let curso of cursos) {
        const resH = await fetch(`${API_HOR}/horarios`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ curso_id: curso.id })
        });
        const horarios = await resH.json();

        let horariosHTML = '';
        if(horarios.length === 0) horariosHTML = '<div class="text-muted small p-2">Sin horarios asignados.</div>';
        else {
            horarios.forEach(h => {
                const hStr = encodeURIComponent(JSON.stringify({curso: curso, horario: h}));
                let badgeMod = h.modalidad === 'Virtual' ? 'bg-info' : 'bg-secondary';
                if(h.modalidad === '24/7' || h.modalidad === 'Híbrido') badgeMod = 'bg-purple text-white';

                horariosHTML += `
                <div class="d-flex justify-content-between align-items-center p-2 border-bottom small">
                    <div>
                        <strong>Sec. ${h.seccion}</strong> - ${h.dia} 
                        (${h.hora_inicio ? h.hora_inicio.slice(0,5)+'-'+h.hora_fin.slice(0,5) : '24/7'})
                        <span class="badge ${badgeMod}">${h.modalidad}</span>
                        <div class="text-muted" style="font-size:0.8em">Vac: ${h.vacantes}</div>
                    </div>
                    <button onclick="agregarCursoManual('${hStr}')" class="btn btn-sm btn-outline-dark">
                        <i class="fa fa-plus"></i>
                    </button>
                </div>`;
            });
        }

        container.innerHTML += `
        <div class="card mb-2">
            <div class="card-header py-2 fw-bold" style="font-size:0.9rem">
                ${curso.nombre} <span class="badge bg-light text-dark border">${curso.creditos} Cr</span>
            </div>
            <div class="card-body p-0 bg-white">
                ${horariosHTML}
            </div>
        </div>`;
    }
}

function agregarCursoManual(hStr) {
    const item = JSON.parse(decodeURIComponent(hStr));
    
    if(cursosManualTemp.find(x => x.curso.id === item.curso.id)) {
        mostrarToast("⚠️ El alumno ya tiene este curso.", "bg-warning");
        return;
    }
    
    if(item.horario.hora_inicio) {
        const nIni = parseInt(item.horario.hora_inicio.replace(':',''));
        const nFin = parseInt(item.horario.hora_fin.replace(':',''));
        const nDias = item.horario.dia.split(',').map(d=>d.trim());

        for(let m of cursosManualTemp) {
            if(!m.horario.hora_inicio) continue;
            const mDias = m.horario.dia.split(',').map(d=>d.trim());
            const cruceDia = nDias.some(d => mDias.includes(d));
            if(cruceDia) {
                const mIni = parseInt(m.horario.hora_inicio.replace(':',''));
                const mFin = parseInt(m.horario.hora_fin.replace(':',''));
                if(nIni < mFin && nFin > mIni) {
                    mostrarToast("⛔ Cruce de horarios detectado.", "bg-danger");
                    return;
                }
            }
        }
    }

    cursosManualTemp.push(item);
    actualizarCarritoManual();
    mostrarToast("Curso agregado", "bg-success");
}

function actualizarCarritoManual() {
    const list = document.getElementById('manual-matricula-list');
    list.innerHTML = '';
    let creds = 0;

    if(cursosManualTemp.length === 0) {
        list.innerHTML = '<li class="list-group-item bg-transparent text-center text-muted">Ningún curso seleccionado</li>';
    } else {
        cursosManualTemp.forEach((item, index) => {
            creds += item.curso.creditos;
            list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center small p-2">
                <div>
                    <div class="fw-bold">${item.curso.nombre}</div>
                    <div class="text-muted">Sec. ${item.horario.seccion}</div>
                </div>
                <button onclick="removerCursoManual(${index})" class="btn btn-sm text-danger"><i class="fa fa-times"></i></button>
            </li>`;
        });
    }
    document.getElementById('manual-creditos').innerText = creds;
}

function removerCursoManual(index) {
    cursosManualTemp.splice(index, 1);
    actualizarCarritoManual();
}

async function confirmarMatriculaManualAdmin() {
    if(cursosManualTemp.length === 0) return mostrarToast("Seleccione cursos", "bg-warning");
    if(!alumnoSeleccionado) return;

    const data = {
        usuario_id: alumnoSeleccionado.id,
        alumno_nombre: alumnoSeleccionado.nombre,
        carrera_id: alumnoSeleccionado.carrera_id, 
        ciclo: alumnoSeleccionado.ciclo, 
        cursos: cursosManualTemp,
        total_creditos: document.getElementById('manual-creditos').innerText
    };

    try {
        const res = await fetch(`${API_INS}/matricular`, {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
        });
        
        if(!res.ok) throw new Error("Error en guardado");

        for(let item of cursosManualTemp) {
            await fetch(`${API_HOR}/restar-vacante`, {
                method:'PUT', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ horario_id: item.horario.id })
            });
        }

        mostrarToast("✅ Matrícula generada exitosamente", "bg-success");
        modalManual.hide();
        cargarMatriculasAdmin();

    } catch (e) {
        mostrarToast("Error al procesar matrícula", "bg-danger");
        console.error(e);
    }
}

// ... existing code ...
// (Mantener funciones de solicitudes, eliminar horario, etc)

async function cargarSolicitudes() {
    const tb = document.getElementById('tabla-solicitudes');
    tb.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';
    
    const res = await fetch(API_SOL);
    const data = await res.json();
    
    tb.innerHTML = '';
    if(data.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" class="text-center">No hay solicitudes pendientes.</td></tr>';
        return;
    }

    data.forEach(s => {
        const fecha = new Date(s.fecha_solicitud).toLocaleString();
        const estadoBadge = s.estado === 'pendiente' 
            ? '<span class="badge bg-warning text-dark">Pendiente</span>' 
            : '<span class="badge bg-success">Aceptada</span>';
        
        let btnAccion = '';
        if(s.estado === 'pendiente') {
            const sData = encodeURIComponent(JSON.stringify(s));
            btnAccion = `<button onclick="aceptarSolicitud('${sData}')" class="btn btn-success btn-sm"><i class="fa fa-check"></i> Aceptar Solicitud</button>`;
        } else {
            btnAccion = '<span class="text-muted small"><i class="fa fa-check-circle"></i> Procesada</span>';
        }

        tb.innerHTML += `
        <tr>
            <td>${fecha}</td>
            <td>${s.curso_nombre}</td>
            <td>${s.ciclo}</td>
            <td>${estadoBadge}</td>
            <td>${btnAccion}</td>
        </tr>`;
    });
}

async function aceptarSolicitud(sData) {
    const s = JSON.parse(decodeURIComponent(sData));
    solicitudActualId = s._id; 

    document.getElementById('idHorarioEditar').value = ''; 
    document.getElementById('modalTitleHorario').innerText = "Atender Solicitud de Apertura";

    const selCarrera = document.getElementById('asigCarrera');
    if (s.carrera_id && s.carrera_id != 0) {
        selCarrera.value = s.carrera_id;
        selCarrera.disabled = true; 
    } else {
        selCarrera.value = 0;
        selCarrera.disabled = false; 
        mostrarToast("⚠️ Carrera no detectada. Seleccione manualmente.", "bg-warning");
    }

    await cargarDatosAsignacion();

    const selCurso = document.getElementById('asigCurso');
    if (s.curso_id && s.curso_id != 0 && selCarrera.value != 0) {
        selCurso.value = s.curso_id;
        selCurso.disabled = true; 
    } else {
        selCurso.disabled = false; 
    }

    const selProf = document.getElementById('asigProf');
    selProf.value = ''; 
    selProf.disabled = false; 
    
    document.getElementById('asigSec').value = '';
    document.getElementById('asigVac').value = 30;
    document.getElementById('asigIni').value = '';
    document.getElementById('asigFin').value = '';
    document.querySelectorAll('.chk-dia').forEach(cb => cb.checked = false);

    modalAsig.show();
}

function eliminarHorario(id) {
    idEliminarTemp = id;
    document.getElementById('msgConfirm').innerText = "¿Seguro que desea eliminar este horario?";
    modalConfirm.show();
}

document.getElementById('btnConfirmYes').addEventListener('click', async () => {
    modalConfirm.hide();
    if(!idEliminarTemp) return;

    const res = await fetch(API_HOR+'/eliminar-horario', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id: idEliminarTemp})
    });

    if(res.ok) { 
        mostrarToast("🗑️ Eliminado", "bg-warning"); 
        cargarTablaHorarios(); 
    } else { 
        mostrarToast("Error al eliminar", "bg-danger"); 
    }
    idEliminarTemp = null; 
});

async function cargarDatosAsignacion() {
    const cid = document.getElementById('asigCarrera').value;
    const sc = document.getElementById('asigCurso'); const sp = document.getElementById('asigProf');
    
    sc.innerHTML='<option>Cargando...</option>'; sp.innerHTML='<option>Cargando...</option>'; 
    sp.disabled=true; 

    if(cid==0) { sc.innerHTML='<option>Esperando...</option>'; sp.innerHTML='<option>Esperando...</option>'; return; }
    
    const r1 = await fetch(`${API_CUR}/cursos?carrera=${cid}`); const d1 = await r1.json();
    sc.innerHTML=''; 
    if(d1.length==0) sc.innerHTML='<option>No hay cursos</option>';
    else d1.forEach(c => sc.innerHTML+=`<option value="${c.id}">${c.nombre} (Ciclo ${c.ciclo})</option>`); 
    
    if(!solicitudActualId || (solicitudActualId && !document.getElementById('asigCarrera').disabled)) {
         sc.disabled=false; 
    }

    const r2 = await fetch(`${API_AUTH}/usuarios?rol=profesor&carrera=${cid}`); const d2 = await r2.json();
    sp.innerHTML=''; 
    if(d2.length==0) sp.innerHTML='<option>No hay profesores</option>';
    else d2.forEach(p => sp.innerHTML+=`<option value="${p.id}">${p.nombre}</option>`); 
    
    sp.disabled=false; 
}

async function guardarHorario() {
    const dias = []; document.querySelectorAll('.chk-dia:checked').forEach(cb => dias.push(cb.value));
    
    const mod = document.getElementById('asigMod').value;
    if(mod !== '24/7' && mod !== 'Híbrido' && dias.length===0) return mostrarToast("⚠️ Selecciona al menos un día", "bg-warning");

    const idEdit = document.getElementById('idHorarioEditar').value;
    const method = idEdit ? 'PUT' : 'POST'; 

    const data = {
        id: idEdit,
        curso_id: document.getElementById('asigCurso').value,
        seccion: document.getElementById('asigSec').value,
        profesor_id: document.getElementById('asigProf').value,
        profesor_nombre: document.getElementById('asigProf').options[document.getElementById('asigProf').selectedIndex].text,
        dia: (mod === '24/7' || mod === 'Híbrido') ? '24/7' : dias.join(', '),
        inicio: (mod === '24/7' || mod === 'Híbrido') ? null : document.getElementById('asigIni').value,
        fin: (mod === '24/7' || mod === 'Híbrido') ? null : document.getElementById('asigFin').value,
        vacantes: document.getElementById('asigVac').value,
        modalidad: mod
    };

    const res = await fetch(API_HOR+'/asignar-horario', {method: method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    
    if(res.ok) {
        if (solicitudActualId) {
            await fetch(API_SOL + '/aceptar', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: solicitudActualId })
            });
            cargarSolicitudes(); 
            mostrarToast("✅ Solicitud Atendida y Horario Creado", "bg-success");
        } else {
            mostrarToast(idEdit ? "✅ Horario editado" : "✅ Horario creado", "bg-success");
        }

        modalAsig.hide();
        cargarTablaHorarios(); 
        
        solicitudActualId = null;
        document.getElementById('asigCarrera').disabled = false;
        document.getElementById('asigCurso').disabled = true;

    } else {
        const err = await res.json();
        mostrarToast("⛔ " + err.error, "bg-danger");
    }
}

async function cargarTablaHorarios() {
    const cid = document.getElementById('filtroCarreraHor').value; const tb = document.getElementById('tabla-horarios-todos'); tb.innerHTML='';
    if(cid==0) { tb.innerHTML='<tr><td colspan="9" class="text-center">Seleccione carrera</td></tr>'; return; }
    const res = await fetch(`${API_HOR}/horarios-todos?carrera=${cid}`); const data = await res.json();
    if(data.length===0) tb.innerHTML='<tr><td colspan="9" class="text-center">No hay horarios</td></tr>';
    
    data.forEach(h => {
        const hString = encodeURIComponent(JSON.stringify(h));
        
        let horarioTexto = '';
        if(h.hora_inicio && h.hora_fin) {
            horarioTexto = `${h.hora_inicio.slice(0,5)}-${h.hora_fin.slice(0,5)}`;
        } else {
            horarioTexto = '<span class="">24/7</span>';
        }

        tb.innerHTML+=`
        <tr>
            <td>${h.ciclo}</td><td>${h.curso_nombre}</td><td>${h.seccion}</td><td>${h.profesor_nombre}</td>
            <td>${h.dia}</td><td>${horarioTexto}</td>
            <td>${h.vacantes}</td><td>${h.modalidad||'-'}</td>
            <td>
                <button onclick="editarHorario('${hString}')" class="btn btn-sm btn-warning" title="Editar"><i class="fa fa-edit"></i></button>
                <button onclick="eliminarHorario(${h.id})" class="btn btn-sm btn-danger" title="Eliminar"><i class="fa fa-trash"></i></button>
            </td>
        </tr>`;
    });
}