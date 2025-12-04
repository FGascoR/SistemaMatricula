const dbMysql = require('../config/db_mysql');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const sendResponse = (res, statusCode, data) => {
    res.writeHead(statusCode, { 
        'Content-Type': 'application/json',
        ...corsHeaders 
    });
    res.end(JSON.stringify(data));
};

const getBody = (req) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (e) {
                resolve({});
            }
        });
    });
};

const queryMySQL = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        dbMysql.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

module.exports = { sendResponse, getBody, corsHeaders, queryMySQL };