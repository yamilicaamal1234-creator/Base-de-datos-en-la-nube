require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const incidenciasRoutes = require('./routes/incidenciasRoutes');
const authRoutes = require('./routes/authRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/incidencias', incidenciasRoutes);
app.get("/api/health", async (req, res) => {
  try {
    const db = require("./config/db").getDB();
    await db.command({ ping: 1 });
    res.json({ servidor: "activo", mongodb: "conectado" });
  } catch (error) {
    res.status(503).json({ servidor: "activo", mongodb: "no disponible" });
  }
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ No se pudo iniciar la API:", error.message);
    process.exit(1);
  }
}

startServer();