const { MongoClient } = require('mongodb');
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
let db = null;

async function connectMongo() {
    if (!db) {
        await client.connect();
        db = client.db('matricula_db');
        console.log('🍃 Mongo Conectado');
    }
    return db;
}
module.exports = { connectMongo };