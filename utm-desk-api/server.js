require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const incidenciasRoutes = require('./routes/incidenciasRoutes');
const authRoutes = require('./routes/authRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/incidencias', incidenciasRoutes);
app.use(express.static(require("path").join(__dirname, "frontend")));
app.get("/api/health", async (req, res) => {
  try {
    const db = require("./config/db").getDB();
    await db.command({ ping: 1 });
    res.json({ servidor: "activo", mongodb: "conectado" });
  } catch (error) {
    res.status(503).json({ servidor: "activo", mongodb: "no disponible" });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'El formato de la solicitud JSON no es válido' });
  }
  next(err);
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor iniciado en http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("❌ No se pudo iniciar la API:", error.message);
    process.exit(1);
  }
}

startServer();