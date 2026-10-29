const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es requerido' });
    }
    if (!password) {
      return res.status(400).json({ error: 'La contraseña es requerida' });
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
    const credenciales = await db.collection('credenciales').findOne({ auth_uid: usuario.auth_uid });
    if (!credenciales?.password_hash) {
      return res.status(403).json({ error: 'La cuenta no tiene credenciales configuradas' });
    }
    const passwordValida = await bcrypt.compare(password, credenciales.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Generar Token JWT con sub = auth_uid
    const token = jwt.sign(
      {
        sub: usuario.auth_uid,
        email: usuario.correo,
        role: usuario.rol,
        primer_nombre: usuario.primer_nombre,
        apellido_paterno: usuario.apellido_paterno
      },
      JWT_SECRET,
      { expiresIn: '7d', algorithm: 'HS256', issuer: 'utm-desk-api' }
    );

    res.json({
      mensaje: 'Autenticación exitosa',
      token,
      usuario: {
        auth_uid: usuario.auth_uid,
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

    res.json(usuarios);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

async function actualizarUsuario(req, res) {
  try {
    const db = getDB();
    const { auth_uid } = req.params;
    const { rol, activo } = req.body;

    const updateFields = {};
    if (rol) updateFields.rol = rol;
    if (typeof activo === 'boolean') updateFields.activo = activo;

    const resultado = await db.collection('roles').updateOne(
      { auth_uid },
      { $set: updateFields }
    );

    if (resultado.matchedCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

module.exports = {
  login,
  obtenerPerfil,
  listarUsuarios,
  actualizarUsuario
};
