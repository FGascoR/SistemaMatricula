const toastEl = document.getElementById('loginToast');
const toast = new bootstrap.Toast(toastEl);

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
            mostrarToast("✅ Bienvenido/a " + data.user.nombre, "success");
            
            // GUARDAR DATOS DEL USUARIO
            localStorage.setItem('usuario_id', data.user.id);
            localStorage.setItem('usuario_nombre', data.user.nombre);
            localStorage.setItem('usuario_rol', data.user.rol);
            localStorage.setItem('usuario_ciclo', data.user.ciclo);
            localStorage.setItem('usuario_carrera', data.user.carrera_id);
            
            setTimeout(() => {
                // REDIRECCION SEGUN ROL
                if (data.user.rol === 'admin') {
                    window.location.href = 'admin.html';
                } else if (data.user.rol === 'profesor') {
                    window.location.href = 'profesor.html';
                } else {
                    window.location.href = 'panel.html'; // Alumno
                }
            }, 1500);
            
        } else {
            mostrarToast("⛔ " + (data.error || "Datos incorrectos"), "danger");
            resetBtn(btn);
        }

    } catch (error) {
        console.error(error);
        mostrarToast("⚠️ Error de conexión con el servidor", "warning");
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