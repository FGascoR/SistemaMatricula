const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'matricula_db'
});
connection.connect(e => { 
    if(e) console.error('Error MySQL:', e); 
    else console.log('🐬 MySQL Conectado'); 
});
module.exports = connection;