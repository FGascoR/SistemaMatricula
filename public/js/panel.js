// --- ESTADO GLOBAL ---
let cursosDisponibles = [];
let matricula = []; 
let cursoTemp = null;
const modal = new bootstrap.Modal(document.getElementById('modalSeccion'));
const toastEl = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastEl);

const USUARIO_ID = localStorage.getItem('usuario_id');
const USUARIO_NOMBRE = localStorage.getItem('usuario_nombre');

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

// --- RENDERIZADO DE CURSOS ---
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

// --- AGREGAR CURSO TEMPORALMENTE ---
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

// --- CONFIRMACIÓN FINAL (PROCESO COMPLEJO) ---
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

    // 2. Restar Vacantes en Postgres (Iteramos y restamos 1 a cada sección)
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

// --- RENDERIZADORES VISTAS ---
function renderizarTablaMisCursos() {
    const tbody = document.getElementById('tabla-mis-cursos');
    tbody.innerHTML = '';
    if(matricula.length === 0) return tbody.innerHTML = '<tr><td colspan="6" class="text-center">Sin cursos</td></tr>';
    matricula.forEach(m => {
        tbody.innerHTML += `
        <tr>
            <td>${m.curso.codigo}</td>
            <td>${m.curso.nombre}</td>
            <td>${m.horario.seccion}</td>
            <td>${m.horario.profesor_nombre || 'Docente'}</td>
            <td>${m.horario.dia} ${m.horario.hora_inicio.slice(0,5)}</td>
            <td>${m.curso.creditos}</td>
        </tr>`;
    });
}

function dibujarHorarioEnGrid() {
            const grid = document.getElementById('timetable-grid');
            grid.innerHTML = ''; 
            const dias = ['Hora', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            dias.forEach(d => grid.innerHTML += `<div class="day-header">${d}</div>`);

            for(let h=8; h<=16; h++) {
                grid.innerHTML += `<div class="time-header text-dark bg-white border-0" style="display:flex; align-items:center; justify-content:center; font-size:0.8rem;">${h}:00</div>`;
                
                for(let d=1; d<=6; d++) {
                    const diaNombreColumna = dias[d];
                    
                    // BUSCAR CLASE
                    const clase = matricula.find(m => {
                        const ini = parseInt(m.horario.hora_inicio.split(':')[0]);
                        const fin = parseInt(m.horario.hora_fin.split(':')[0]);
                        
                        // TRUCO: Convertimos el string "Lunes, Miercoles" en array y buscamos si incluye el día actual
                        // Normalizamos (quitamos tildes o espacios extra por si acaso)
                        const diasClase = m.horario.dia.split(',').map(s => s.trim()); 
                        
                        const esElDia = diasClase.includes(diaNombreColumna);
                        const esLaHora = h >= ini && h < fin;

                        return esElDia && esLaHora;
                    });

                    if(clase) {
                        grid.innerHTML += `
                        <div class="course-cell p-0">
                            <div class="event-block" style="background: black; color: white; height: 90%; margin: 2px; padding: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; font-size: 0.7rem;">
                                <div style="font-weight: bold; line-height: 1.1; margin-bottom: 2px;">
                                    ${clase.curso.nombre}
                                </div>
                                <div>
                                    ${clase.horario.hora_inicio.slice(0,5)} - ${clase.horario.hora_fin.slice(0,5)}
                                </div>
                            </div>
                        </div>`;
                    } else {
                        grid.innerHTML += `<div class="course-cell" style="border: 1px solid #eee;"></div>`;
                    }
                }
            }
        }

function navigate(viewId) {
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    document.getElementById('link-' + viewId).classList.add('active');
    document.querySelectorAll('.section-view').forEach(s => s.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    if(viewId === 'horario') dibujarHorarioEnGrid();
    if(viewId === 'mis-cursos') renderizarTablaMisCursos();
}

function descargarTablaPDF() { html2pdf(document.getElementById('area-impresion-tabla')); }
function descargarHorarioImg() { html2canvas(document.getElementById('area-impresion-horario')).then(c => { const l=document.createElement('a'); l.download='horario.png'; l.href=c.toDataURL(); l.click(); }); }
function descargarHorarioPDF() { html2pdf(document.getElementById('area-impresion-horario')); }