const express = require('express');
const router = express.Router();
const { login, obtenerPerfil, listarUsuarios, crearUsuario, actualizarUsuario } = require('../controllers/authController');
const { verificarTokenYRol } = require('../middlewares/auth');

// Ruta pública para login
router.post('/login', login);

// Rutas protegidas
router.get('/perfil', verificarTokenYRol, obtenerPerfil);
router.get('/usuarios', verificarTokenYRol, listarUsuarios);
router.post('/usuarios', verificarTokenYRol, crearUsuario);
router.put('/usuarios/:auth_uid', verificarTokenYRol, actualizarUsuario);

module.exports = router;
