// --- ESTADO GLOBAL ---
let cursosDisponibles = [];
let matricula = []; 
let cursoTemp = null;
const modal = new bootstrap.Modal(document.getElementById('modalSeccion'));
const toastEl = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastEl);

const USUARIO_ID = localStorage.getItem('usuario_id');
const USUARIO_NOMBRE = localStorage.getItem('usuario_nombre');

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
        const res = await fetch(`http://localhost:3002/api/cursos?ciclo=${cicloUsuario}`);
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

        tbody.innerHTML += `
        <tr class="${rowClass}">
            <td class="fw-bold">${h.seccion}</td>
            <td>${h.profesor_nombre || 'Por asignar'}</td>
            <td>${h.dia}</td>
            <td>${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)}</td>
            <td><span class="badge bg-light text-dark border">${h.modalidad || 'Presencial'}</span></td>
            <td class="text-center">${vacantesHTML}</td>
            <td>${btnHTML}</td>
        </tr>`;
    });
}

// --- AGREGAR CURSO TEMPORALMENTE (CON VALIDACIÓN DE CRUCES) ---
function agregarCurso(hString) {
    const horario = JSON.parse(decodeURIComponent(hString));
    const nInicio = parseInt(horario.hora_inicio.replace(':',''));
    const nFin = parseInt(horario.hora_fin.replace(':',''));
    
    // Array de días del curso nuevo
    const diasNuevo = horario.dia.split(',').map(s => s.trim());

    // Validar Cruce
    for(let m of matricula) {
        // Array de días del curso ya matriculado
        const diasMatriculado = m.horario.dia.split(',').map(s => s.trim());

        // Ver si tienen algún día en común
        const coincidenDias = diasNuevo.some(d => diasMatriculado.includes(d));

        if(coincidenDias) {
            const eInicio = parseInt(m.horario.hora_inicio.replace(':',''));
            const eFin = parseInt(m.horario.hora_fin.replace(':',''));
            
            // Si coinciden en día y hora -> ERROR
            // Fórmula de intersección: (StartA < EndB) && (EndA > StartB)
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
    
    // 1. Guardar en Mongo (Historial del Alumno)
    const data = {
        usuario_id: parseInt(USUARIO_ID),
        alumno_nombre: USUARIO_NOMBRE,
        cursos: matricula,
        total_creditos: document.getElementById('contador-creditos').innerText
    };

    await fetch('http://localhost:3004/api/matricular', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });

    // 2. Restar Vacantes en Postgres
    for(let item of matricula) {
        // Ojo: Envia 'horario_id' que coincide con el backend corregido
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
        // Formatear días para que se vea limpio (ej: Lunes, Miercoles -> Lunes / Miercoles)
        const diasFormat = m.horario.dia.replace(/,/g, ' / ');
        
        tbody.innerHTML += `
        <tr>
            <td class="fw-bold">${m.curso.codigo}</td>
            <td>${m.curso.nombre}</td>
            <td>${m.horario.seccion}</td>
            <td>${m.horario.profesor_nombre || 'Docente'}</td>
            <td>
                <div class="small fw-bold">${diasFormat}</div>
                <div class="small text-muted">${m.horario.hora_inicio.slice(0,5)} - ${m.horario.hora_fin.slice(0,5)}</div>
            </td>
            <td class="text-center">${m.curso.creditos}</td>
        </tr>`;
    });
}

// 2. Dibujar Horario Visual (Grid CSS Exacto)
// 2. Dibujar Horario Visual (VERSIÓN FINAL - CENTRADO ROBUSTO)
function dibujarHorarioEnGrid() {
    const grid = document.getElementById('timetable-grid');
    grid.innerHTML = ''; 

    // A. HEADERS
    const dias = ['Hora', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    dias.forEach(d => {
        grid.innerHTML += `<div class="day-header">${d}</div>`;
    });

    // B. FONDO REJILLA
    const horaInicioGrid = 8;
    const horaFinGrid = 22;

    for(let h = horaInicioGrid; h < horaFinGrid; h++) {
        const labelHora = `${h.toString().padStart(2,'0')}:00`;
        grid.innerHTML += `<div class="time-header">${labelHora}</div>`;
        for(let d=0; d<6; d++) {
            grid.innerHTML += `<div class="course-cell"></div>`;
        }
    }

    // C. PINTAR BLOQUES
    const mapDias = { 
        'lunes': 2, 'martes': 3, 'miercoles': 4, 
        'jueves': 5, 'viernes': 6, 'sabado': 7,
        'lun': 2, 'mar': 3, 'mie': 4, 'jue': 5, 'vie': 6, 'sab': 7 
    };

    matricula.forEach(m => {
        const [hIni, mIni] = m.horario.hora_inicio.split(':').map(Number);
        const [hFin, mFin] = m.horario.hora_fin.split(':').map(Number);

        const inicioTotalMin = hIni * 60 + mIni;
        const finTotalMin = hFin * 60 + mFin;
        const duracionMin = finTotalMin - inicioTotalMin;

        // Fila de inicio
        const gridRowStart = (hIni - horaInicioGrid) + 2; 
        
        // Píxeles por minuto
        const pxPorMinuto = 1; 
        const marginTop = mIni * pxPorMinuto; 
        const height = duracionMin * pxPorMinuto; 

        const diasClase = m.horario.dia.split(',').map(s => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

        diasClase.forEach(diaNombre => {
            const gridCol = mapDias[diaNombre];
            
            if (gridCol) {
                const bloque = document.createElement('div');
                bloque.className = 'event-block';
                bloque.innerHTML = `
                    <div class="fw-bold text-truncate">${m.curso.nombre}</div>
                    <div>${m.horario.hora_inicio.slice(0,5)} - ${m.horario.hora_fin.slice(0,5)}</div>
                    <div class="small text-warning">Sec. ${m.horario.seccion}</div>
                `;

                // 1. Ubicación en la rejilla
                bloque.style.gridArea = `${gridRowStart} / ${gridCol} / auto / ${gridCol + 1}`;
                bloque.style.position = 'absolute';
                
                // --- CORRECCIÓN DE CENTRADO ---
                bloque.style.width = '94%';      // Ocupa el 94% del ancho de la columna
                bloque.style.left = '0';         // Anclado a la izquierda
                bloque.style.right = '0';        // Anclado a la derecha
                bloque.style.marginLeft = 'auto'; // Margen automático
                bloque.style.marginRight = 'auto';// Margen automático (esto centra el bloque)
                
                // Limpiamos cualquier transform previo
                bloque.style.transform = 'none'; 
                
                // Posición vertical y altura
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