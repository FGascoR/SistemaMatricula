const toastEl = document.getElementById('loginToast');
const toast = new bootstrap.Toast(toastEl);
const modalDeuda = new bootstrap.Modal(document.getElementById('modalDeudaMatricula'));
let usuarioTemp = null;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const correo = document.getElementById('correo').value;
    const contrasena = document.getElementById('contrasena').value;
    const btn = document.querySelector('button');

    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...';
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:3001/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                correo: correo, 
                contrasena: contrasena 
            })
        });

        const data = await response.json();

       if (response.ok && data.success) {
            mostrarToast("Bienvenido/a " + data.user.nombre, "success");
            
            localStorage.setItem('usuario_id', data.user.id);
            localStorage.setItem('usuario_nombre', data.user.nombre);
            localStorage.setItem('usuario_rol', data.user.rol);
            localStorage.setItem('usuario_ciclo', data.user.ciclo);
            localStorage.setItem('usuario_carrera', data.user.carrera_id);
            
            console.log('Rol detectado:', data.user.rol); 

            if (data.user.rol === 'admin') {
                mostrarToast("Bienvenido Admin", "success");
                setTimeout(() => window.location.href = 'admin.html', 1000);
            } else if (data.user.rol === 'profesor') {
                mostrarToast("Bienvenido Docente", "success");
                setTimeout(() => window.location.href = 'profesor.html', 1000);
            } else {
                verificarPagoAlumno(data.user);
            }

            
        } else {
            mostrarToast("" + (data.error || "Datos incorrectos"), "danger");
            resetBtn(btn);
        }

    } catch (error) {
        console.error(error);
        mostrarToast("Error de conexión con el servidor", "warning");
        resetBtn(btn);
    }
});

function resetBtn(btn) {
    btn.innerHTML = "INICIAR SESIÓN";
    btn.disabled = false;
}

function mostrarToast(mensaje, tipo) {
    const toastBody = document.getElementById('toast-msg');
    const toastDiv = document.getElementById('loginToast');
    
    toastDiv.className = `toast align-items-center text-white border-0 bg-${tipo}`;
    toastBody.innerText = mensaje;
    toast.show();
}

async function verificarPagoAlumno(user) {
    usuarioTemp = user;
    try {
        const res = await fetch(`http://localhost:3008/api/estado-cuenta?id=${user.id}`);
        const estado = await res.json();

        if (estado.matricula_pagada) {
            mostrarToast("Bienvenido/a " + user.nombre, "success");
            setTimeout(() => window.location.href = 'panel.html', 1000);
        } else {
            document.getElementById('lblNombreDeudor').innerText = user.nombre;
            modalDeuda.show();
        }
    } catch (e) {
        console.error(e);
        window.location.href = 'panel.html';
    }
}

function irAPanelDirecto() {
    window.location.href = 'panel.html';
}

function irAPasarelaPago() {
    modalDeuda.hide();
    document.getElementById('payment-gateway').classList.remove('d-none');
}

function cancelarPagoGateway() {
    document.getElementById('payment-gateway').classList.add('d-none');
    modalDeuda.show(); 
}

async function procesarPagoLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnPagarGateway');
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Procesando...';
    btn.disabled = true;

    setTimeout(async () => {
        try {
            await fetch('http://localhost:3008/api/pagar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alumno_id: usuarioTemp.id,
                    alumno_nombre: usuarioTemp.nombre,
                    concepto: 'Matrícula 2025-I',
                    monto: 300.00
                })
            });

            btn.className = "btn btn-success w-100 py-2 fw-bold";
            btn.innerHTML = '<i class="fa fa-check"></i> ¡PAGO EXITOSO!';
            
            setTimeout(() => {
                window.location.href = 'panel.html';
            }, 1500);

        } catch (error) {
            alert("Error al procesar pago");
            btn.disabled = false;
            btn.innerText = "PAGAR AHORA";
        }
    }, 2000);
}