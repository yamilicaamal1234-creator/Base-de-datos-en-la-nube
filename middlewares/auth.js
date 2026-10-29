const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

async function verificarTokenYRol(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Falta el token de autorización' });
    }

    const token = authHeader.split(' ')[1];

    // 1. Decodificar el token sin forzar un algoritmo específico (soporta HS256 y ES256)
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: 'Estructura de token irreconocible' });
    }

    const auth_uid = decoded.sub; // ID único del usuario

    // 2. Buscar en MongoDB el rol y estado del usuario en la colección "roles"
    //    Primero por campo auth_uid, y si tiene formato ObjectId también por _id
    const db = getDB();
    const conditions = [{ auth_uid: auth_uid }];
    if (/^[a-f\d]{24}$/i.test(auth_uid)) {
      try {
        conditions.push({ _id: new ObjectId(auth_uid) });
      } catch (_) { /* no es ObjectId válido */ }
    }
    const filtro = conditions.length === 1 ? conditions[0] : { $or: conditions };
    const usuario = await db.collection('roles').findOne(filtro);

    if (!usuario) {
      return res.status(403).json({ error: 'Usuario no registrado en la base de datos operativa' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'La cuenta se encuentra desactivada' });
    }

    // 3. Inyectar datos del usuario en la petición
    req.usuario = {
      auth_uid: usuario.auth_uid || usuario._id.toString(),
      rol: usuario.rol,
      primer_nombre: usuario.primer_nombre,
      apellido_paterno: usuario.apellido_paterno
    };

    next();
  } catch (error) {
    console.error("Error procesando token:", error.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

module.exports = { verificarTokenYRol };