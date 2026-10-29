const { MongoClient } = require("mongodb");
require("dotenv").config();

let client;
let database;

async function connectDB() {
  if (database) return database;

  const uri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME;

  if (!uri || !dbName) {
    throw new Error("Faltan MONGO_URI o DB_NAME en el archivo .env");
  }

  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);

  await database.command({ ping: 1 });
  console.log(`✅ MongoDB conectado exitosamente a: ${dbName}`);

  return database;
}

function getDB() {
  if (!database) throw new Error("La base de datos todavía no está conectada.");
  return database;
}

module.exports = { connectDB, getDB };