const express = require('express');
const router = express.Router();
const { verificarTokenYRol } = require('../middlewares/auth');
const { obtenerIncidencias, crearIncidencia, actualizarEstadoIncidencia } = require('../controllers/incidenciasController');
const { upload } = require('../config/cloudinary');

// Middleware global de seguridad para estas rutas
router.use(verificarTokenYRol);

// GET: Obtener lista de incidencias
router.get('/', obtenerIncidencias);

// POST: Crear una nueva incidencia (espera un archivo llamado 'evidencia')
router.post('/', upload.single('evidencia'), crearIncidencia);

// PUT: Actualizar el estado de una incidencia específica
router.put('/:codigo/estado', actualizarEstadoIncidencia);

module.exports = router;