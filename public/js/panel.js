let cursosDisponibles = [];
let matricula = []; 
let cursoTemp = null;
let matriculaOriginal = []; 
const modal = new bootstrap.Modal(document.getElementById('modalSeccion'));
const modalSolicitud = new bootstrap.Modal(document.getElementById('modalConfirmarSolicitud')); 
const toastEl = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastEl);

const USUARIO_ID = localStorage.getItem('usuario_id');

if (!USUARIO_ID) window.location.href = 'index.html';

document.addEventListener('DOMContentLoaded', async () => {
    await cargarCursosBackend();
    await cargarMatriculaGuardada();
});

function mostrarToast(msg, bgClass = 'bg-primary') {
    document.getElementById('toast-message').innerText = msg;
    toastEl.className = `toast align-items-center text-white border-0 ${bgClass}`;
    toast.show();
}

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
            
            matriculaOriginal = JSON.parse(JSON.stringify(matricula)); 
            
            renderizarTablaMisCursos();
            dibujarHorarioEnGrid();
            actualizarResumen();
            renderizarCursosDisponibles();
        }
    } catch (e) { console.error(e); }
}
function renderizarCursosDisponibles() {
    const container = document.getElementById('lista-cursos-disponibles');
    container.innerHTML = '';
    
    if (cursosDisponibles.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No hay cursos disponibles para tu carrera y ciclo actual.</div>';
        return;
    }
    
    cursosDisponibles.forEach(curso => {
        const yaInscrito = matricula.find(m => m.curso.id === curso.id);
        
        const btnClass = yaInscrito ? 'btn-dark' : 'btn-dark';
        const btnText = yaInscrito ? '<i class="fa fa-pen"></i> Modificar' : 'Seleccionar';
        
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
            <button onclick="abrirModal(${curso.id})" class="btn ${btnClass}" id="btn-${curso.id}">${btnText}</button>
        </div>`;
    });
}

async function abrirModal(idCurso) {
    cursoTemp = cursosDisponibles.find(c => c.id === idCurso);
    const tbody = document.getElementById('modal-lista-horarios');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando...</td></tr>';
    
    const inscritoPrevio = matricula.find(m => m.curso.id === idCurso);
    const modalFooter = document.querySelector('#modalSeccion .modal-footer');
    
    const btnBorrarExistente = document.getElementById('btn-dejar-curso');
    if(btnBorrarExistente) btnBorrarExistente.remove();

    if (inscritoPrevio) {
        const btnDelete = document.createElement('button');
        btnDelete.id = 'btn-dejar-curso';
        btnDelete.className = 'btn btn-danger btn-sm me-2';
        btnDelete.innerHTML = '<i class="fa fa-trash"></i> Dejar Curso';
        btnDelete.onclick = function() { dejarCurso(idCurso); };
        modalFooter.prepend(btnDelete); 
    }

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
        
        let vacantesHTML = `<span class="fw-bold">${h.vacantes}</span>`;
        let btnHTML = '';
        let rowClass = '';

        const esMiHorario = inscritoPrevio && inscritoPrevio.horario.id === h.id;
        const textoBoton = esMiHorario ? 'Actual' : 'Elegir';
        const claseBoton = esMiHorario ? 'btn-success disabled' : 'btn-dark';

        if (h.vacantes === 0 && !esMiHorario) {
            vacantesHTML = `<span class="text-danger fw-bold">0</span>`;
            btnHTML = `<span class="badge bg-danger">AGOTADO</span>`;
            rowClass = 'opacity-50'; 
        } else {
            btnHTML = `<button onclick="agregarCurso('${hString}')" class="btn btn-sm ${claseBoton}">${textoBoton}</button>`;
        }

        let modBadge = 'bg-light text-dark border';
        if (h.modalidad === 'Virtual') modBadge = 'bg-info text-dark';
        if (h.modalidad === '24/7' || h.modalidad === 'Híbrido') modBadge = 'bg-purple text-white';

        let horarioTexto = (h.hora_inicio && h.hora_fin) 
            ? `${h.hora_inicio.slice(0,5)} - ${h.hora_fin.slice(0,5)}` 
            : '<span class="">24/7</span>';

        tbody.innerHTML += `
        <tr class="${rowClass} ${esMiHorario ? 'table-success' : ''}">
            <td class="fw-bold">${h.seccion}</td>
            <td>${h.profesor_nombre || 'Por asignar'}</td>
            <td>${h.dia}</td>
            <td>${horarioTexto}</td>
            <td><span class="badge ${modBadge}">${h.modalidad || 'Presencial'}</span></td>
            <td class="text-center">${vacantesHTML}</td>
            <td>${btnHTML}</td>
        </tr>`;
    });
}

function dejarCurso(idCurso) {
    matricula = matricula.filter(m => m.curso.id !== idCurso);
    
    actualizarResumen();
    renderizarCursosDisponibles();
    renderizarTablaMisCursos();
    dibujarHorarioEnGrid();
    
    modal.hide();
    mostrarToast("🗑️ Has dejado el curso. No olvides confirmar matrícula para guardar cambios.", "bg-warning");
}

function abrirConfirmarSolicitud() {
    modal.hide(); 
    modalSolicitud.show();
}

async function enviarSolicitud() {
    try {
        const body = {
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
            mostrarToast("Solicitud enviada exitosamente", "bg-success");
        } else {
            mostrarToast("Error al enviar solicitud", "bg-danger");
        }
    } catch (e) {
        mostrarToast("Error de conexión", "bg-danger");
        console.error(e);
    } finally {
        modalSolicitud.hide();
    }
}

function agregarCurso(hString) {
    const horario = JSON.parse(decodeURIComponent(hString));
    
    if (horario.hora_inicio && horario.hora_fin) {
        const nInicio = parseInt(horario.hora_inicio.replace(':',''));
        const nFin = parseInt(horario.hora_fin.replace(':',''));
        const diasNuevo = horario.dia.split(',').map(s => s.trim());

        for(let m of matricula) {
            if (m.curso.id === cursoTemp.id) continue; 

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
    }

    matricula = matricula.filter(m => m.curso.id !== cursoTemp.id);

    matricula.push({ curso: cursoTemp, horario: horario });
    
    actualizarResumen();
    renderizarCursosDisponibles(); 
    modal.hide();
    
    mostrarToast(`✅ Curso actualizado: ${cursoTemp.nombre}`, "bg-success");
}

function actualizarResumen() {
    let cred = 0, hrs = 0;
    matricula.forEach(m => { cred += m.curso.creditos; hrs += m.curso.horas; });
    document.getElementById('contador-creditos').innerText = cred;
    document.getElementById('contador-horas').innerText = hrs;
}

async function confirmarMatricula() {
    if(matricula.length === 0 && matriculaOriginal.length === 0) {
        return mostrarToast("⚠️ Selecciona cursos primero.", "bg-warning");
    }
    
    const data = {
        usuario_id: parseInt(USUARIO_ID),
        alumno_nombre: localStorage.getItem('usuario_nombre'),
        cursos: matricula,
        total_creditos: document.getElementById('contador-creditos').innerText
    };

    try {
        await fetch('http://localhost:3004/api/matricular', {
            method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
        });

    
        for (const itemOriginal of matriculaOriginal) {
            const sigueEstando = matricula.find(m => m.horario.id === itemOriginal.horario.id);
            if (!sigueEstando) {
                await fetch('http://localhost:3003/api/sumar-vacante', {
                    method:'PUT', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ horario_id: itemOriginal.horario.id })
                });
                console.log(`Vacante liberada para horario ID: ${itemOriginal.horario.id}`);
            }
        }

      
        for (const itemActual of matricula) {
            const estabaAntes = matriculaOriginal.find(m => m.horario.id === itemActual.horario.id);
            if (!estabaAntes) {
                await fetch('http://localhost:3003/api/restar-vacante', {
                    method:'PUT', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ horario_id: itemActual.horario.id })
                });
                console.log(`Vacante restada para horario ID: ${itemActual.horario.id}`);
            }
        }

        matriculaOriginal = JSON.parse(JSON.stringify(matricula));

        mostrarToast("Matrícula y vacantes actualizadas correctamente", "bg-success");

        setTimeout(async () => {
            navigate('mis-cursos'); 
            await cargarCursosBackend(); 
        }, 1500);

    } catch (e) {
        console.error(e);
        mostrarToast("Error al procesar la matrícula", "bg-danger");
    }
}

function renderizarTablaMisCursos() {
    const tbody = document.getElementById('tabla-mis-cursos');
    tbody.innerHTML = '';
    
    if(matricula.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Sin cursos matriculados</td></tr>';
        return;
    }

    matricula.forEach(m => {
        const diasFormat = m.horario.dia.replace(/,/g, ' / ');
        
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


function dibujarHorarioEnGrid() {
    const grid = document.getElementById('timetable-grid');
    const virtualContainer = document.getElementById('virtual-courses-container'); 
    
    grid.innerHTML = ''; 
    virtualContainer.innerHTML = ''; 

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
        
      
        if (!m.horario.hora_inicio || !m.horario.hora_fin || m.horario.modalidad === '24/7') {
            
            virtualContainer.innerHTML += `
                <div class="virtual-course-banner">
                    <div>
                        <span class="virtual-badge"><i class="fa-solid fa-laptop"></i> Virtual 24/7</span>
                        <span class="virtual-course-name">${m.curso.nombre}</span>
                    </div>
                    <div>
                        <span class="me-3"><i class="fa-solid fa-chalkboard-user"></i> ${m.horario.profesor_nombre || 'Docente UTP'}</span>
                        <span><i class="fa-solid fa-hashtag"></i> Sec. ${m.horario.seccion}</span>
                    </div>
                </div>
            `;
            return; 
        }

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
    
    if(viewId === 'pagos') cargarPagosPanel(); 
}

async function cargarPagosPanel() {
    const tbodyCuotas = document.getElementById('tabla-cuotas');
    const tbodyHist = document.getElementById('tabla-historial');
    const badgeMat = document.getElementById('estado-matricula-badge');

    try {
        const res = await fetch(`http://localhost:3008/api/estado-cuenta?id=${USUARIO_ID}`);
        const data = await res.json();

        if(data.matricula_pagada) {
            badgeMat.innerHTML = '<span class="badge bg-success fs-5">Matrícula al Día</span>';
        } else {
            badgeMat.innerHTML = '<span class="badge bg-danger fs-5 mb-2">Matrícula Pendiente</span><br><button onclick="pagarConcepto(\'Matrícula 2025-I\', 300)" class="btn btn-warning btn-sm fw-bold text-dark mt-2">Pagar Ahora S/300</button>';
        }

        tbodyCuotas.innerHTML = '';
        data.cuotas.forEach(c => {
            let btn = '';
            let badge = '';
            
            if(c.estado === 'Pagado') {
                badge = '<span class="badge bg-success">Pagado</span>';
                btn = `<span class="text-muted small"><i class="fa fa-check"></i> ${new Date(c.fecha_pago).toLocaleDateString()}</span>`;
            } else {
                badge = '<span class="badge bg-warning text-dark">Pendiente</span>';
                btn = `<button onclick="pagarConcepto('${c.concepto}', ${c.monto})" class="btn btn-outline-dark btn-sm">Pagar</button>`;
            }

            tbodyCuotas.innerHTML += `
            <tr>
                <td>${c.concepto}</td>
                <td>${c.vencimiento}</td>
                <td class="fw-bold">S/ ${c.monto.toFixed(2)}</td>
                <td>${badge}</td>
                <td>${btn}</td>
            </tr>`;
        });

        tbodyHist.innerHTML = '';
        if(data.historial.length === 0) {
            tbodyHist.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin pagos registrados</td></tr>';
        }
        data.historial.forEach(h => {
            tbodyHist.innerHTML += `
            <tr>
                <td>${new Date(h.fecha).toLocaleString()}</td>
                <td>${h.concepto}</td>
                <td>${h.metodo}</td>
                <td>S/ ${h.monto.toFixed(2)}</td>
            </tr>`;
        });

    } catch (e) { console.error(e); }
}

async function pagarConcepto(concepto, monto) {
    if(!confirm(`¿Deseas simular el pago de: ${concepto} por S/ ${monto}?`)) return;

    try {
        await fetch('http://localhost:3008/api/pagar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alumno_id: parseInt(USUARIO_ID),
                alumno_nombre: localStorage.getItem('usuario_nombre'),
                concepto: concepto,
                monto: monto
            })
        });
        
        mostrarToast("Pago registrado correctamente", "bg-success");
        cargarPagosPanel(); 
    } catch (e) {
        mostrarToast("Error al pagar", "bg-danger");
    }
}

function descargarTablaPDF() { html2pdf(document.getElementById('area-impresion-tabla')); }
function descargarHorarioImg() { html2canvas(document.getElementById('area-impresion-horario')).then(c => { const l=document.createElement('a'); l.download='horario.png'; l.href=c.toDataURL(); l.click(); }); }
function descargarHorarioPDF() { html2pdf(document.getElementById('area-impresion-horario')); }