const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('SUPABASE_JWT_SECRET no está configurado');
}

// Roles que NO deben tener campo "perfil" según el validador de MongoDB
const ROLES_SIN_PERFIL = ['tecnico', 'coordinador', 'directivo', 'administrador'];
// Roles que SÍ deben tener campo "perfil"
const ROLES_CON_PERFIL = ['reportante'];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.startsWith('scrypt$')) return false;
  const [, salt, expectedHex] = storedHash.split('$');
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es requerido' });
    }

    const db = getDB();
    const cleanEmail = email.trim().toLowerCase();

    // Buscar en colección roles por correo (insensible a mayúsculas)
    const usuario = await db.collection('roles').findOne({
      correo: { $regex: new RegExp(`^${cleanEmail}$`, 'i') }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado en el sistema institucional' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'La cuenta de usuario se encuentra desactivada' });
    }

    // Si el usuario no tiene auth_uid, usar el _id de MongoDB como identificador
    const uid = usuario.auth_uid || usuario._id.toString();

    const credencial = await db.collection('credenciales').findOne({ auth_uid: uid });
    if (credencial) {
      if (!verifyPassword(String(password || ''), credencial.password_hash)) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
      }
    }

    // Generar Token JWT con sub = auth_uid
    const token = jwt.sign(
      {
        sub: uid,
        email: usuario.correo,
        role: usuario.rol,
        primer_nombre: usuario.primer_nombre,
        apellido_paterno: usuario.apellido_paterno
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      mensaje: 'Autenticación exitosa',
      token,
      usuario: {
        auth_uid: uid,
        nombre: `${usuario.primer_nombre} ${usuario.apellido_paterno}`,
        primer_nombre: usuario.primer_nombre,
        apellido_paterno: usuario.apellido_paterno,
        correo: usuario.correo,
        rol: usuario.rol,
        perfil: usuario.perfil || null,
        activo: usuario.activo
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno en la autenticación' });
  }
}

async function obtenerPerfil(req, res) {
  try {
    res.json({ usuario: req.usuario });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
}

async function listarUsuarios(req, res) {
  try {
    const db = getDB();
    const usuarios = await db.collection('roles')
      .find({})
      .sort({ fecha_creacion: -1 })
      .toArray();

    // Garantizar que todos los usuarios tengan un auth_uid válido.
    const usuariosNormalizados = usuarios.map(u => {
      const { password_hash, ...usuarioSeguro } = u;
      return {
        ...usuarioSeguro,
        auth_uid: u.auth_uid || u._id.toString()
      };
    });

    res.json(usuariosNormalizados);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

async function crearUsuario(req, res) {
  try {
    if (req.usuario.rol !== 'administrador') {
      return res.status(403).json({ error: 'Solo un administrador puede crear usuarios' });
    }

    const db = getDB();
    const primerNombre = String(req.body.primer_nombre || '').trim();
    const apellidoPaterno = String(req.body.apellido_paterno || '').trim();
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const rol = String(req.body.rol || '').trim().toLowerCase();
    const perfil = String(req.body.perfil || '').trim();
    const password = String(req.body.password || '');
    const passwordConfirm = String(req.body.password_confirm || '');
    const activo = typeof req.body.activo === 'boolean' ? req.body.activo : true;
    const rolesPermitidos = ['reportante', 'tecnico', 'coordinador', 'directivo', 'administrador'];

    if (!primerNombre || !apellidoPaterno || !correo || !rol) {
      return res.status(400).json({ error: 'Nombre, apellido, correo y rol son obligatorios' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido' });
    }
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    const existente = await db.collection('roles').findOne({
      correo: { $regex: new RegExp(`^${correo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const usuario = {
      auth_uid: `uid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nombre_usuario: correo.split('@')[0],
      correo,
      primer_nombre: primerNombre,
      apellido_paterno: apellidoPaterno,
      rol,
      activo,
      fecha_creacion: new Date()
    };

    if (rol === 'reportante') {
      usuario.perfil = perfil || 'docente';
    }

    const resultado = await db.collection('roles').insertOne(usuario);
    await db.collection('credenciales').insertOne({
      auth_uid: usuario.auth_uid,
      password_hash: hashPassword(password),
      fecha_creacion: new Date()
    });
    res.status(201).json({
      mensaje: 'Usuario creado correctamente',
      usuario: {
        ...usuario,
        _id: resultado.insertedId
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario: ' + error.message });
  }
}

/**
 * Construye un filtro de búsqueda que encuentra al usuario por auth_uid (campo)
 * o por _id (si auth_uid parece ser un ObjectId válido de 24 hex).
 */
function buildUserFilter(auth_uid) {
  const conditions = [{ auth_uid: auth_uid }];
  if (/^[a-f\d]{24}$/i.test(auth_uid)) {
    try {
      conditions.push({ _id: new ObjectId(auth_uid) });
    } catch (_) { /* no es ObjectId válido */ }
  }
  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

async function actualizarUsuario(req, res) {
  try {
    const db = getDB();
    const auth_uid = decodeURIComponent(req.params.auth_uid);
    const { rol, activo } = req.body;

    // Validar campos
    const updateSet = {};
    const updateUnset = {};

    if (typeof rol === 'string' && rol.trim() !== '') {
      const rolNormalizado = rol.trim().toLowerCase();
      updateSet.rol = rolNormalizado;

      // IMPORTANT: El validador de MongoDB exige que:
      // - rol = "reportante" → DEBE tener campo "perfil"
      // - rol != "reportante" → NO debe tener campo "perfil"
      // Al cambiar a un rol sin perfil, eliminamos el campo perfil del documento.
      if (ROLES_SIN_PERFIL.includes(rolNormalizado)) {
        updateUnset.perfil = '';
      }
    }

    if (typeof activo === 'boolean') updateSet.activo = activo;

    if (Object.keys(updateSet).length === 0 && Object.keys(updateUnset).length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos válidos para actualizar' });
    }

    // Buscar al usuario primero para verificar que existe
    const filtro = buildUserFilter(auth_uid);
    const usuarioExistente = await db.collection('roles').findOne(filtro);

    if (!usuarioExistente) {
      return res.status(404).json({ error: `Usuario no encontrado (uid: ${auth_uid})` });
    }

    // Si estamos cambiando a "reportante" y el usuario no tiene perfil, asignar uno por defecto
    if (updateSet.rol === 'reportante' && !usuarioExistente.perfil) {
      updateSet.perfil = 'docente';
    }

    // Construir la operación de actualización
    const updateOp = {};
    if (Object.keys(updateSet).length > 0) updateOp.$set = updateSet;
    if (Object.keys(updateUnset).length > 0 && !updateSet.perfil) updateOp.$unset = updateUnset;

    // Actualizar usando el _id real del documento (siempre único y sin ambigüedad)
    const resultado = await db.collection('roles').updateOne(
      { _id: usuarioExistente._id },
      updateOp
    );

    if (resultado.matchedCount === 0) {
      return res.status(404).json({ error: `Usuario no encontrado (uid: ${auth_uid})` });
    }

    res.json({ mensaje: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario: ' + error.message });
  }
}

module.exports = {
  login,
  obtenerPerfil,
  listarUsuarios,
  crearUsuario,
  actualizarUsuario
};
