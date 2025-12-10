const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'matricula_db',
    password: '123456789',
    port: 5432,
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error PostgreSQL:', err);
    } else {
        console.log('PostgreSQL Conectado');
        release(); 
    }
});

module.exports = { 
    queryPostgres: (text, params) => pool.query(text, params)
};
