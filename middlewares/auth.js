const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');

async function verificarTokenYRol(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta el token de autorización' });
    }

    const token = authHeader.split(' ')[1];
    
    // 1. Verificar firma del token con Supabase JWT Secret
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const auth_uid = decoded.sub; // ID único de Supabase

    // 2. Buscar en MongoDB el rol y estado del usuario en la colección "roles"
    const db = getDB();
    const usuario = await db.collection('roles').findOne({ auth_uid: auth_uid });

    if (!usuario) {
      return res.status(403).json({ error: 'Usuario no registrado en la base de datos operativa' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'La cuenta se encuentra desactivada' });
    }

    // 3. Inyectar datos del usuario en la petición para que los siguientes procesos los usen
    req.usuario = {
      auth_uid: usuario.auth_uid,
      rol: usuario.rol,
      primer_nombre: usuario.primer_nombre,
      apellido_paterno: usuario.apellido_paterno
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { verificarTokenYRol };