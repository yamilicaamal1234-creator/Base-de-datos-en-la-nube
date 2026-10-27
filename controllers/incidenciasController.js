const { getDB } = require('../config/db');

async function obtenerIncidencias(req, res) {
  try {
    const db = getDB();
    let filtro = {};

    // Control de acceso por rol (Matriz de seguridad)
    if (req.usuario.rol === 'reportante') {
      // El reportante solo puede ver las incidencias que él mismo registró
      filtro = { "reportante.auth_uid": req.usuario.auth_uid };
    } 
    // Los técnicos, coordinadores, directivos y administradores pueden ver más, 
    // luego ajustaremos los filtros específicos para ellos.

    const incidencias = await db.collection('incidencias_campus')
                                .find(filtro)
                                .sort({ fecha_creacion: -1 })
                                .toArray();
                                
    res.json(incidencias);
  } catch (error) {
    console.error("Error al obtener incidencias:", error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { obtenerIncidencias };