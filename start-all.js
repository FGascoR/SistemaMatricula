const { spawn } = require('child_process');

const servers = [
    'src/services/srv_auth.js',     
    'src/services/srv_cursos.js',    
    'src/services/srv_horarios.js',  
    'src/services/srv_inscrip.js',   
    'src/services/srv_reportes.js',
    'src/services/srv_solicitudes.js',
    'src/services/srv_aulas.js', 
    'src/services/srv_pagos.js'    
];

console.log('Iniciando SISTEMA DE MATRÍCULA...');

servers.forEach(serverFile => {
    const serverProcess = spawn('node', [serverFile], { stdio: 'inherit', shell: true });

    serverProcess.on('error', (err) => {
        console.error(`Error al iniciar ${serverFile}: ${err.message}`);
    });

    serverProcess.on('exit', (code) => {
        if (code !== 0) {
            console.log(`${serverFile} se detuvo con código de salida ${code}`);
        }
    });
});