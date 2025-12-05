// --- ESTADO GLOBAL ---
let cursosDisponibles = [];
let matricula = []; 
let cursoTemp = null;
const modal = new bootstrap.Modal(document.getElementById('modalSeccion'));
const modalSolicitud = new bootstrap.Modal(document.getElementById('modalConfirmarSolicitud')); // NUEVO
const toastEl = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastEl);

const USUARIO_ID = localStorage.getItem('usuario_id');
// const USUARIO_NOMBRE = localStorage.getItem('usuario_nombre'); // YA NO SE USA AQUÍ PARA SOLICITUDES

// Verificar sesión
if (!USUARIO_ID) window.location.href = 'index.html';

document.addEventListener('DOMContentLoaded', async () => {
    await cargarCursosBackend();
    await cargarMatriculaGuardada();
});

// --- TOAST FUNCTION ---
function mostrarToast(msg, bgClass = 'bg-primary') {
    document.getElementById('toast-message').innerText = msg;
    toastEl.className = `toast align-items-center text-white border-0 ${bgClass}`;
    toast.show();
}

// --- CARGAR DATOS ---
async function cargarCursosBackend() {
    try {
        const cicloUsuario = localStorage.getItem('usuario_ciclo') || 1;
        const carreraUsuario = localStorage.getItem('usuario_carrera') || 0; 
        
        const res = await fetch(`http://localhost:3002/api/cursos?ciclo=${cicloUsuario}&carrera=${carreraUsuario}`);
        
        cursosDisponibles = await res.json();
        renderizarCursosDisponibles();
    } catch (e) { console.error(e); }
}

async function cargarMatriculaGuardada() {
    try {
        const res = await fetch(`http://localhost:3004/api/mi-matricula?id=${USUARIO_ID}`);
        const data = await res.json();
        if (data.existe) {
            matricula = data.datos.cursos; 
            renderizarTablaMisCursos();
            dibujarHorarioEnGrid();
            actualizarResumen();
            renderizarCursosDisponibles();
        }
    } catch (e) { console.error(e); }
}

// --- RENDERIZADO DE CURSOS DISPONIBLES (TARGETAS) ---
function renderizarCursosDisponibles() {
    const container = document.getElementById('lista-cursos-disponibles');
    container.innerHTML = '';
    
    if (cursosDisponibles.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No hay cursos disponibles para tu carrera y ciclo actual.</div>';
        return;
    }
    
    cursosDisponibles.forEach(curso => {
        const yaInscrito = matricula.find(m => m.curso.id === curso.id);
        const btnState = yaInscrito ? 'disabled btn-secondary' : 'btn-black';
        const btnText = yaInscrito ? 'Inscrito' : 'Seleccionar';

        container.innerHTML += `
        <div class="card-custom mb-3 p-3 d-flex justify-content-between align-items-center">
            <div>
                <h5 class="fw-bold mb-1">${curso.codigo} - ${curso.nombre}</h5>
                <div class="text-muted small">
                    <span class="me-3">Ciclo ${curso.ciclo}</span>
                    <span class="me-3">${curso.creditos} Créditos</span>
                    <span>${curso.horas} Horas</span>
                </div>
            </div>
            <button onclick="abrirModal(${curso.id})" class="btn ${btnState}" id="btn-${curso.id}">${btnText}</button>
        </div>`;
    });
}

// --- MODAL DE HORARIOS ---
async function abrirModal(idCurso) {
    cursoTemp = cursosDisponibles.find(c => c.id === idCurso);
    const tbody = document.getElementById('modal-lista-horarios');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';
    modal.show();

    const res = await fetch('http://localhost:3003/api/horarios', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ curso_id: idCurso })
    });
    const horarios = await res.json();
    
    tbody.innerHTML = '';
    
    if (horarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No hay horarios asignados aún.</td></tr>';
    }

    horarios.forEach(h => {
        const hString = encodeURIComponent(JSON.stringify(h));
        
        // --- LÓGICA DE VACANTES ---
        let vacantesHTML = `<span class="fw-bold">${h.vacantes}</span>`;
        let btnHTML = '';
        let rowClass = '';

        if (h.vacantes === 0) {
            vacantesHTML = `<span class="text-danger fw-bold">0</span>`;
            btnHTML = `<span class="badge bg-danger">AGOTADO</span>`;
            rowClass = 'opacity-50'; 
        } else if (h.vacantes <= 5) {
            vacantesHTML = `<span class="text-warning fw-bold">${h.vacantes} <i class="fa fa-exclamation-triangle"></i></span>`;
            btnHTML = `<button onclick="agregarCurso('${hString}')" class="btn btn-sm btn-dark">Elegir</button>
                       <div class="text-warning small" style="font-size:10px">¡Últimos cupos!</div>`;
        } else {
            btnHTML = `<button onclick="agregarCurso('${hString}')" class="btn btn-sm btn-dark">Elegir</button>`;
        }

        let modBadge = 'bg-light text-dark border';
        if (h.modalidad === 'Virtual') modBadge = 'bg-info text-dark';
        if (h.modalidad === '24/7' || h.modalidad === 'Híbrido') modBadge = 'bg-purple text-white';

        // CORRECCIÓN VISUAL HORA EN MODAL
        let horarioTexto = '';
        if (h.hora_inicio && h.hora_fin) {
            horarioTexto = `${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)}`;
        } else {
            horarioTexto = '<span class="">24/7</span>';
        }

        tbody.innerHTML += `
        <tr class="${rowClass}">
            <td class="fw-bold">${h.seccion}</td>
            <td>${h.profesor_nombre || 'Por asignar'}</td>
            <td>${h.dia}</td>
            <td>${horarioTexto}</td>
            <td><span class="badge ${modBadge}" style="${h.modalidad==='24/7'?'background-color:#6f42c1;color:white':''}">${h.modalidad || 'Presencial'}</span></td>
            <td class="text-center">${vacantesHTML}</td>
            <td>${btnHTML}</td>
        </tr>`;
    });
}

// --- NUEVAS FUNCIONES PARA SOLICITUDES ---
function abrirConfirmarSolicitud() {
    // Cerramos el modal de horarios momentáneamente
    modal.hide(); 
    modalSolicitud.show();
}

async function enviarSolicitud() {
    try {
        const body = {
            // usuario_id: parseInt(USUARIO_ID), // SE ELIMINA ID
            // alumno_nombre: USUARIO_NOMBRE, // SE ELIMINA NOMBRE
            curso_id: cursoTemp.id,
            curso_nombre: cursoTemp.nombre,
            ciclo: cursoTemp.ciclo,
            carrera_id: parseInt(localStorage.getItem('usuario_carrera') || 0)
        };

        const res = await fetch('http://localhost:3006/api/solicitudes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });

        if(res.ok) {
            mostrarToast("✅ Solicitud enviada exitosamente", "bg-success");
        } else {
            mostrarToast("⛔ Error al enviar solicitud", "bg-danger");
        }
    } catch (e) {
        mostrarToast("⛔ Error de conexión", "bg-danger");
        console.error(e);
    } finally {
        modalSolicitud.hide();
    }
}

// --- AGREGAR CURSO TEMPORALMENTE (CON VALIDACIÓN DE CRUCES) ---
function agregarCurso(hString) {
    const horario = JSON.parse(decodeURIComponent(hString));
    
    // SI ES 24/7 NO HAY CRUCE DE HORAS POSIBLE
    if (!horario.hora_inicio || !horario.hora_fin) {
        matricula.push({ curso: cursoTemp, horario: horario });
        actualizarResumen();
        renderizarCursosDisponibles();
        modal.hide();
        mostrarToast(`Curso agregado: ${cursoTemp.nombre}`, "bg-success");
        return;
    }

    const nInicio = parseInt(horario.hora_inicio.replace(':',''));
    const nFin = parseInt(horario.hora_fin.replace(':',''));
    
    // Array de días del curso nuevo
    const diasNuevo = horario.dia.split(',').map(s => s.trim());

    // Validar Cruce
    for(let m of matricula) {
        if (m.curso.id === cursoTemp.id) {
             return mostrarToast("⛔ Ya tienes este curso agregado.", "bg-warning");
        }

        // Si el curso matriculado es 24/7, saltamos validación de horas
        if (!m.horario.hora_inicio || !m.horario.hora_fin) continue;

        const diasMatriculado = m.horario.dia.split(',').map(s => s.trim());
        const coincidenDias = diasNuevo.some(d => diasMatriculado.includes(d));

        if(coincidenDias) {
            const eInicio = parseInt(m.horario.hora_inicio.replace(':',''));
            const eFin = parseInt(m.horario.hora_fin.replace(':',''));
            
            if(nInicio < eFin && nFin > eInicio) {
                return mostrarToast("⛔ Cruce de horario con " + m.curso.nombre, "bg-danger");
            }
        }
    }

    matricula.push({ curso: cursoTemp, horario: horario });
    actualizarResumen();
    renderizarCursosDisponibles();
    modal.hide();
    mostrarToast(`Curso agregado: ${cursoTemp.nombre}`, "bg-success");
}

function actualizarResumen() {
    let cred = 0, hrs = 0;
    matricula.forEach(m => { cred += m.curso.creditos; hrs += m.curso.horas; });
    document.getElementById('contador-creditos').innerText = cred;
    document.getElementById('contador-horas').innerText = hrs;
}

// --- CONFIRMACIÓN FINAL ---
async function confirmarMatricula() {
    if(matricula.length === 0) return mostrarToast("⚠️ Selecciona cursos primero.", "bg-warning");
    
    const data = {
        usuario_id: parseInt(USUARIO_ID),
        alumno_nombre: localStorage.getItem('usuario_nombre'), // Usamos nombre aqui solo para mongo matriculas
        cursos: matricula,
        total_creditos: document.getElementById('contador-creditos').innerText
    };

    await fetch('http://localhost:3004/api/matricular', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });

    for(let item of matricula) {
        await fetch('http://localhost:3003/api/restar-vacante', {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ horario_id: item.horario.id })
        });
    }

    mostrarToast("✅ ¡Matrícula Procesada Correctamente!", "bg-success");

    setTimeout(async () => {
        navigate('mis-cursos'); 
        await cargarCursosBackend(); 
    }, 1500);
}

// --- RENDERIZADORES DE VISTAS ---

// 1. Tabla "Mis Cursos" (Formato Mejorado)
function renderizarTablaMisCursos() {
    const tbody = document.getElementById('tabla-mis-cursos');
    tbody.innerHTML = '';
    
    if(matricula.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Sin cursos matriculados</td></tr>';
        return;
    }

    matricula.forEach(m => {
        const diasFormat = m.horario.dia.replace(/,/g, ' / ');
        
        // CORRECCIÓN VISUAL PARA 24/7 EN TABLA MIS CURSOS
        let horarioTexto = '';
        if (m.horario.hora_inicio && m.horario.hora_fin) {
            horarioTexto = `${m.horario.hora_inicio.slice(0,5)} - ${m.horario.hora_fin.slice(0,5)}`;
        } else {
            horarioTexto = '<span class="">24/7 (24/7)</span>';
        }

        tbody.innerHTML += `
        <tr>
            <td class="fw-bold">${m.curso.codigo}</td>
            <td>${m.curso.nombre}</td>
            <td>${m.horario.seccion}</td>
            <td>${m.horario.profesor_nombre || 'Docente'}</td>
            <td>
                <div class="small fw-bold">${diasFormat}</div>
                <div class="small text-muted">${horarioTexto}</div>
            </td>
            <td class="text-center">${m.curso.creditos}</td>
        </tr>`;
    });
}

// 2. Dibujar Horario Visual (VERSIÓN FINAL - CENTRADO ROBUSTO)
function dibujarHorarioEnGrid() {
    const grid = document.getElementById('timetable-grid');
    grid.innerHTML = ''; 

    const dias = ['Hora', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    dias.forEach(d => {
        grid.innerHTML += `<div class="day-header">${d}</div>`;
    });

    const horaInicioGrid = 8;
    const horaFinGrid = 22;

    for(let h = horaInicioGrid; h < horaFinGrid; h++) {
        const labelHora = `${h.toString().padStart(2,'0')}:00`;
        grid.innerHTML += `<div class="time-header">${labelHora}</div>`;
        for(let d=0; d<6; d++) {
            grid.innerHTML += `<div class="course-cell"></div>`;
        }
    }

    const mapDias = { 
        'lunes': 2, 'martes': 3, 'miercoles': 4, 
        'jueves': 5, 'viernes': 6, 'sabado': 7,
        'lun': 2, 'mar': 3, 'mie': 4, 'jue': 5, 'vie': 6, 'sab': 7 
    };

    matricula.forEach(m => {
        // --- CORRECCIÓN IMPORTANTE ---
        // Si el curso no tiene hora (es 24/7), NO intentamos dibujarlo en la grilla
        if (!m.horario.hora_inicio || !m.horario.hora_fin) return;

        const [hIni, mIni] = m.horario.hora_inicio.split(':').map(Number);
        const [hFin, mFin] = m.horario.hora_fin.split(':').map(Number);

        const inicioTotalMin = hIni * 60 + mIni;
        const finTotalMin = hFin * 60 + mFin;
        const duracionMin = finTotalMin - inicioTotalMin;

        const gridRowStart = (hIni - horaInicioGrid) + 2; 
        
        const pxPorMinuto = 1; 
        const marginTop = mIni * pxPorMinuto; 
        const height = duracionMin * pxPorMinuto; 

        const diasClase = m.horario.dia.split(',').map(s => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

        diasClase.forEach(diaNombre => {
            const gridCol = mapDias[diaNombre];
            
            if (gridCol) {
                const bloque = document.createElement('div');
                bloque.className = 'event-block';
                
                if (m.horario.modalidad === 'Virtual') bloque.style.backgroundColor = '#0dcaf0'; 
                // if (m.horario.modalidad === '24/7') ... (Ya no se dibuja en grid)
                if (m.horario.modalidad === 'Virtual') bloque.style.color = '#000'; 

                bloque.innerHTML = `
                    <div class="fw-bold text-truncate">${m.curso.nombre}</div>
                    <div>${m.horario.hora_inicio.slice(0,5)} - ${m.horario.hora_fin.slice(0,5)}</div>
                    <div class="small" style="opacity:0.8">Sec. ${m.horario.seccion}</div>
                `;

                bloque.style.gridArea = `${gridRowStart} / ${gridCol} / auto / ${gridCol + 1}`;
                bloque.style.position = 'absolute';
                
                bloque.style.width = '94%';      
                bloque.style.left = '0';         
                bloque.style.right = '0';        
                bloque.style.marginLeft = 'auto'; 
                bloque.style.marginRight = 'auto';
                
                bloque.style.transform = 'none'; 
                
                bloque.style.marginTop = `${marginTop}px`; 
                bloque.style.height = `${height}px`; 
                bloque.style.zIndex = '10';
                bloque.style.alignSelf = 'start'; 

                grid.appendChild(bloque);
            }
        });
    });
}
function navigate(viewId) {
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    document.getElementById('link-' + viewId).classList.add('active');
    document.querySelectorAll('.section-view').forEach(s => s.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    if(viewId === 'horario') dibujarHorarioEnGrid();
    if(viewId === 'mis-cursos') renderizarTablaMisCursos();
}

// --- UTILIDADES DE DESCARGA ---
function descargarTablaPDF() { html2pdf(document.getElementById('area-impresion-tabla')); }
function descargarHorarioImg() { html2canvas(document.getElementById('area-impresion-horario')).then(c => { const l=document.createElement('a'); l.download='horario.png'; l.href=c.toDataURL(); l.click(); }); }
function descargarHorarioPDF() { html2pdf(document.getElementById('area-impresion-horario')); }