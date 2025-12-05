const API_AUTH = 'http://localhost:3001/api'; 
const API_CUR = 'http://localhost:3002/api'; 
const API_HOR = 'http://localhost:3003/api';
const API_SOL = 'http://localhost:3006/api/solicitudes'; 

const modalProf = new bootstrap.Modal(document.getElementById('modalNuevoProfe'));
const modalAsig = new bootstrap.Modal(document.getElementById('modalAsignacion'));
const modalConfirm = new bootstrap.Modal(document.getElementById('modalConfirm')); 

const toastEl = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastEl);

let idEliminarTemp = null; 
let solicitudActualId = null; // Para saber si estamos procesando una solicitud

// --- TOAST FUNCTION ---
function mostrarToast(msg, bgClass = 'bg-primary') {
    document.getElementById('toast-message').innerText = msg;
    toastEl.className = `toast align-items-center text-white border-0 ${bgClass}`;
    toast.show();
}

document.addEventListener('DOMContentLoaded', async () => { 
    await cargarCarreras(); 
    ver('alumnos'); 
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
}

async function cargarCarreras() {
    const res = await fetch(API_AUTH + '/carreras'); const data = await res.json();
    const fill = (id) => { const s = document.getElementById(id); s.innerHTML='<option value="0">Seleccione...</option>'; data.forEach(c=>s.innerHTML+=`<option value="${c.id}">${c.nombre}</option>`); };
    fill('filtroCarreraAlu'); fill('filtroCarreraProf'); fill('filtroCarreraCur'); fill('asigCarrera'); fill('profCarreraSelect'); fill('filtroCarreraHor');
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
    // Modo "NUEVO HORARIO" (Manual)
    document.getElementById('idHorarioEditar').value = ''; 
    document.getElementById('modalTitleHorario').innerText = "Asignar Nuevo Horario";
    
    // Habilitar y resetear todo
    const selCarrera = document.getElementById('asigCarrera');
    selCarrera.value = 0;
    selCarrera.disabled = false;
    
    document.getElementById('asigCurso').innerHTML = '<option>Esperando...</option>'; document.getElementById('asigCurso').disabled = true;
    document.getElementById('asigProf').innerHTML = '<option>Esperando...</option>'; document.getElementById('asigProf').disabled = true;
    
    document.getElementById('asigSec').value = '';
    document.getElementById('asigVac').value = 30;
    document.getElementById('asigIni').value = '';
    document.getElementById('asigFin').value = '';
    document.querySelectorAll('.chk-dia').forEach(cb => cb.checked = false);
    
    solicitudActualId = null; // No es solicitud
    modalAsig.show();
}

async function editarHorario(hString) {
    // Modo "EDITAR HORARIO"
    const h = JSON.parse(decodeURIComponent(hString));
    document.getElementById('idHorarioEditar').value = h.id; 
    document.getElementById('modalTitleHorario').innerText = "Editar Horario";
    
    // 1. Establecer Carrera y permitir cambio
    const selCarrera = document.getElementById('asigCarrera');
    if (h.carrera_id) selCarrera.value = h.carrera_id;
    selCarrera.disabled = false; 

    // 2. Cargar listas completas
    await cargarDatosAsignacion();

    // 3. Seleccionar valores actuales
    document.getElementById('asigCurso').value = h.curso_id;
    document.getElementById('asigProf').value = h.profesor_id;
    
    document.getElementById('asigSec').value = h.seccion;
    document.getElementById('asigVac').value = h.vacantes;
    document.getElementById('asigIni').value = h.hora_inicio || ''; // Manejar NULL
    document.getElementById('asigFin').value = h.hora_fin || '';    // Manejar NULL
    document.getElementById('asigMod').value = h.modalidad || 'Presencial';
    
    // Manejar días (si es 24/7 viene como "24/7", no checkbox)
    const dias = h.dia ? h.dia.split(',').map(d=>d.trim()) : [];
    document.querySelectorAll('.chk-dia').forEach(cb => cb.checked = dias.includes(cb.value));

    mostrarToast("⚠️ Modo edición: Verifica los datos.", "bg-info");
    solicitudActualId = null; 
    modalAsig.show();
}

// --- LÓGICA DE SOLICITUDES ---
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
    // Modo "CREAR DESDE SOLICITUD"
    const s = JSON.parse(decodeURIComponent(sData));
    solicitudActualId = s._id; 

    document.getElementById('idHorarioEditar').value = ''; 
    document.getElementById('modalTitleHorario').innerText = "Atender Solicitud de Apertura";

    // 1. Pre-seleccionar Carrera (Con validación de seguridad por el error de ID=0)
    const selCarrera = document.getElementById('asigCarrera');
    
    // IMPORTANTE: Si la carrera es válida (distinta de 0 y null), la seleccionamos.
    if (s.carrera_id && s.carrera_id != 0) {
        selCarrera.value = s.carrera_id;
        selCarrera.disabled = true; // Bloqueamos si es correcto
    } else {
        // SI ES 0 (ERROR DE MONGO): Dejamos en "Seleccione..." y HABILITADO
        selCarrera.value = 0;
        selCarrera.disabled = false; 
        mostrarToast("⚠️ Carrera no detectada. Seleccione manualmente.", "bg-warning");
    }

    // 2. Cargar datos dependientes (esto llenará cursos y profes si hay carrera, si no espera)
    await cargarDatosAsignacion();

    // 3. Pre-seleccionar Curso (Con validación)
    const selCurso = document.getElementById('asigCurso');
    if (s.curso_id && s.curso_id != 0 && selCarrera.value != 0) {
        // Solo intentar setear curso si la carrera es válida y coincide
        selCurso.value = s.curso_id;
        selCurso.disabled = true; 
    } else {
        // Si no hay carrera válida, el curso no se puede cargar aún
        selCurso.disabled = false; 
    }

    // 4. Asegurar que Profesor esté limpio y HABILITADO
    const selProf = document.getElementById('asigProf');
    selProf.value = ''; 
    selProf.disabled = false; // ¡Forzamos habilitado!
    
    // Limpiar otros campos
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
    
    // Cargar Cursos
    const r1 = await fetch(`${API_CUR}/cursos?carrera=${cid}`); const d1 = await r1.json();
    sc.innerHTML=''; 
    if(d1.length==0) sc.innerHTML='<option>No hay cursos</option>';
    else d1.forEach(c => sc.innerHTML+=`<option value="${c.id}">${c.nombre} (Ciclo ${c.ciclo})</option>`); 
    
    // Si NO es solicitud o si la solicitud tenía ID 0 (y por tanto carrera se habilitó), habilitamos curso
    if(!solicitudActualId || (solicitudActualId && !document.getElementById('asigCarrera').disabled)) {
         sc.disabled=false; 
    }

    // Cargar Profesores
    const r2 = await fetch(`${API_AUTH}/usuarios?rol=profesor&carrera=${cid}`); const d2 = await r2.json();
    sp.innerHTML=''; 
    if(d2.length==0) sp.innerHTML='<option>No hay profesores</option>';
    else d2.forEach(p => sp.innerHTML+=`<option value="${p.id}">${p.nombre}</option>`); 
    
    sp.disabled=false; // ¡IMPORTANTE! Habilitamos profesores siempre
}

async function guardarHorario() {
    const dias = []; document.querySelectorAll('.chk-dia:checked').forEach(cb => dias.push(cb.value));
    
    // Validación especial para 24/7: No requiere días ni horas
    const mod = document.getElementById('asigMod').value;
    if(mod !== '24/7' && mod !== 'Híbrido' && dias.length===0) return mostrarToast("⚠️ Selecciona al menos un día", "bg-warning");

    const idEdit = document.getElementById('idHorarioEditar').value;
    const method = idEdit ? 'PUT' : 'POST'; 

    // Datos flexibles para 24/7
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
        
        // --- CORRECCIÓN VISUAL PARA 24/7 ---
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