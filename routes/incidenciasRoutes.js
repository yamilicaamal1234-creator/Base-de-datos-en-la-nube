const express = require('express');
const router = express.Router();
const { verificarTokenYRol } = require('../middlewares/auth');
// ¡Aquí está la importación unificada con las 4 funciones!
const { obtenerIncidencias, crearIncidencia, actualizarEstadoIncidencia, obtenerEstadisticasDashboard } = require('../controllers/incidenciasController');
const { upload } = require('../config/cloudinary');

// Middleware global de seguridad para estas rutas
router.use(verificarTokenYRol);

// GET: Estadísticas para el Dashboard Analítico (RF-06)
router.get('/dashboard/estadisticas', obtenerEstadisticasDashboard);

// GET: Obtener lista de incidencias
router.get('/', obtenerIncidencias);

// POST: Crear una nueva incidencia (espera un archivo llamado 'evidencia')
router.post('/', upload.single('evidencia'), crearIncidencia);

// PUT: Actualizar el estado de una incidencia específica
router.put('/:codigo/estado', actualizarEstadoIncidencia);

module.exports = router;