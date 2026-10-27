const express = require('express');
const router = express.Router();
const { verificarTokenYRol } = require('../middlewares/auth');
const { obtenerIncidencias } = require('../controllers/incidenciasController');

// Todas las rutas que estén debajo de esta línea exigirán un token válido
router.use(verificarTokenYRol);

// Endpoint: GET /api/incidencias
router.get('/', obtenerIncidencias);

module.exports = router;