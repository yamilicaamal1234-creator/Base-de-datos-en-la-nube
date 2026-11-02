
function isValidDescripcionRiesgo(desc) {
  const str = String(desc || '').trim();
  if (!str) return false;
  if (str.length < 8 || str.length > 400) return false;
  if (/^\d+$/.test(str)) return false;
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}/.test(str)) return false;
  return true;
}

function isValidInsumos(insumos) {
  const str = String(insumos || '').trim();
  if (!str) return true;
  const items = str.split(',').map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return false;
  if (items.length > 15) return false;
  for (const it of items) {
    if (it.length < 2 || it.length > 60) return false;
    if (/^\d+$/.test(it)) return false;
    if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(it)) return false;
  }
  return true;
}

function isValidEstudiantes(val) {
  const str = String(val ?? '').trim();
  if (!str) return true;
  if (!/^\d+$/.test(str)) return false;
  const n = Number(str);
  return Number.isInteger(n) && n >= 0 && n <= 5000;
}


function isValidIPv4(ip) {
  const str = String(ip || '').trim();
  if (!str) return true;
  const parts = str.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    if (n < 0 || n > 255) return false;
    if (part.length > 1 && part.startsWith('0')) return false;
  }
  return true;
}

function isValidVLAN(vlan) {
  const str = String(vlan || '').trim();
  if (!str) return true;
  if (!/^\d+$/.test(str)) return false;
  const n = Number(str);
  return Number.isInteger(n) && n >= 1 && n <= 4094;
}

function isValidPuerto(puerto) {
  const str = String(puerto || '').trim();
  if (!str) return true;
  if (str.length > 25) return false;
  if (/^\d+$/.test(str)) {
    const n = Number(str);
    return n >= 1 && n <= 96;
  }
  const switchInterfaceRegex = /^(?:(?:Gi|Fa|Te|Fo|Eth|FastEthernet|GigabitEthernet|ge|fe|xe)[s-]?)?\d{1,2}(?:[\/\-]\d{1,2}){1,3}$/i;
  if (switchInterfaceRegex.test(str)) return true;
  const portLabelRegex = /^(?:Puerto|Port|P|Jack|Roseta|J|PP|Panel|Rack)[s-]?[A-Za-z0-9]{1,4}(?:[\-\/][A-Za-z0-9]{1,4})*$/i;
  if (portLabelRegex.test(str)) return true;
  const simpleRackRegex = /^[A-Za-z0-9]{1,3}[\-\/][A-Za-z0-9]{1,4}$/;
  if (simpleRackRegex.test(str)) return true;
  return false;
}

const { getDB } = require('../config/db');
const { cloudinary } = require('../config/cloudinary');

async function obtenerIncidencias(req, res) {
  try {
    const db = getDB();
    let filtro = {};

    // Si el usuario es reportante, solo ve sus incidencias
    if (req.usuario.rol === 'reportante') {
      filtro = { "reportante.auth_uid": req.usuario.auth_uid };
    }

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

async function crearIncidencia(req, res) {
  try {
    const db = getDB();
    
    // 1. Extraer y parsear datos (soporta multipart/form-data o JSON puro)
    let datos = req.body;
    if (req.body.datos) {
      datos = typeof req.body.datos === 'string' ? JSON.parse(req.body.datos) : req.body.datos;
    }

    // Normalizar categoría
    let categoria = (datos.categoria || '').toLowerCase().trim();
    if (categoria === 'infra') categoria = 'infraestructura';

    // Normalizar prioridad
    let prioridad = (datos.prioridad || 'media').toLowerCase().trim();
    prioridad = prioridad.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // "crítica" -> "critica"
    if (!['baja', 'media', 'alta', 'critica'].includes(prioridad)) {
      prioridad = 'media';
    }

    // 2. Subir archivos a Cloudinary si se adjuntaron evidencias (hasta 5)
    let evidencias_adjuntas = [];
    const filesToUpload = req.files && Array.isArray(req.files) && req.files.length > 0
      ? req.files
      : (req.file ? [req.file] : []);

    const filesLimited = filesToUpload.slice(0, 5);

    for (const file of filesLimited) {
      try {
        const subida = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "utm_desk_evidencias", resource_type: "auto" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });

        evidencias_adjuntas.push({
          nombre_archivo: file.originalname,
          tipo_mime: file.mimetype,
          peso_kb: Math.round(file.size / 1024),
          url_storage: subida.secure_url,
          fecha_carga: new Date()
        });
      } catch (uploadErr) {
        console.error(`Error al subir evidencia ${file.originalname} a Cloudinary:`, uploadErr.message);
      }
    }

    // 3. Generar código único secuencial
    const count = await db.collection('incidencias_campus').countDocuments();
    const nuevoCodigo = `INC-2026-${(count + 1).toString().padStart(4, '0')}`;

    // 4. Adaptar detalle_especifico y ubicación según la categoría estricta de MongoDB
    let detalle_especifico = {};
    let ubicacion = null;

    const detIn = datos.detalle_especifico || {};

    if (categoria === 'redes') {
      if (detIn.direccion_ip) {
        const ipStr = String(detIn.direccion_ip).trim();
        if (ipStr && !isValidIPv4(ipStr)) {
          return res.status(400).json({ error: "La dirección IP debe ser un formato IPv4 válido (ej. 192.168.10.45)." });
        }
      }
      if (detIn.vlan) {
        const vlanStr = String(detIn.vlan).trim();
        if (vlanStr && !isValidVLAN(vlanStr)) {
          return res.status(400).json({ error: "La VLAN debe ser un número entero válido entre 1 y 4094." });
        }
      }
      const puertoCheck = detIn.puerto_conexion || detIn.puerto;
      if (puertoCheck) {
        const puertoStr = String(puertoCheck).trim();
        if (puertoStr && !isValidPuerto(puertoStr)) {
          return res.status(400).json({ error: "El puerto de conexión debe ser un formato válido (ej. Gi1/0/24, Fa0/1, Puerto 24 o 1-48)." });
        }
      }

      detalle_especifico = {
        tipo_equipo: detIn.tipo_equipo || 'PC de escritorio'
      };
      if (detIn.direccion_ip) detalle_especifico.direccion_ip = String(detIn.direccion_ip);
      if (detIn.vlan) detalle_especifico.vlan = String(detIn.vlan);
      const puerto = detIn.puerto_conexion || detIn.puerto;
      if (puerto) detalle_especifico.puerto_conexion = String(puerto);

      ubicacion = {
        edificio: datos.ubicacion?.edificio || datos.edificio || 'Edificio A',
        zona: datos.ubicacion?.zona || datos.zona || 'Laboratorio'
      };

        } else if (categoria === 'infraestructura') {
      const tipoDano = detIn.tipo_dano || detIn.tipo_danio;
      if (!tipoDano) {
        return res.status(400).json({ error: "El tipo de daño es obligatorio para infraestructura." });
      }

      let nivelRiesgo = (detIn.nivel_riesgo || 'medio').toLowerCase().trim();
      nivelRiesgo = nivelRiesgo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!['bajo', 'medio', 'alto', 'critico'].includes(nivelRiesgo)) {
        return res.status(400).json({ error: "El nivel de riesgo debe ser: bajo, medio, alto o crítico." });
      }

      const descRiesgo = String(detIn.riesgo_descripcion || detIn.descripcion_riesgo || '').trim();
      if (!descRiesgo || !isValidDescripcionRiesgo(descRiesgo)) {
        return res.status(400).json({ error: "La descripción del riesgo debe contener al menos 8 caracteres descriptivos (no solo números)." });
      }

      let insumos = [];
      if (Array.isArray(detIn.insumos_requeridos)) {
        insumos = detIn.insumos_requeridos;
      } else if (Array.isArray(detIn.insumos)) {
        insumos = detIn.insumos;
      } else if (typeof detIn.insumos === 'string' && detIn.insumos.trim()) {
        insumos = detIn.insumos.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (insumos.length > 0 && !isValidInsumos(insumos.join(', '))) {
        return res.status(400).json({ error: "Los insumos requeridos deben ser nombres válidos de materiales (no solo números)." });
      }

      detalle_especifico = {
        tipo_dano: tipoDano,
        nivel_riesgo: nivelRiesgo,
        riesgo_descripcion: descRiesgo,
        requiere_contratista_externo: Boolean(detIn.requiere_contratista_externo ?? detIn.requiere_contratista ?? false)
      };
      if (insumos.length > 0) {
        detalle_especifico.insumos_requeridos = insumos;
      }

      ubicacion = {
        edificio: datos.ubicacion?.edificio || datos.edificio || 'Edificio C',
        zona: datos.ubicacion?.zona || datos.zona || 'Pasillo'
      };

        } else if (categoria === 'academico') {
      if (!detIn.plataforma) {
        return res.status(400).json({ error: "La plataforma académica es obligatoria." });
      }
      detalle_especifico = {
        plataforma: detIn.plataforma,
        periodo_escolar: detIn.periodo_escolar || detIn.periodo || 'Sep-Dic 2026'
      };
      if (detIn.estudiantes_afectados !== undefined && detIn.estudiantes_afectados !== null && detIn.estudiantes_afectados !== '') {
        const estStr = String(detIn.estudiantes_afectados).trim();
        if (estStr && !isValidEstudiantes(estStr)) {
          return res.status(400).json({ error: "El número de estudiantes afectados debe ser un número entero entre 0 y 5000." });
        }
        detalle_especifico.estudiantes_afectados = Math.max(0, parseInt(estStr, 10) || 0);
      }
      // Nota: El validador prohíbe explícitamente "ubicacion" en categoría academico
      ubicacion = undefined;
    }

    // 5. Preparar tags
    let tags = [];
    if (Array.isArray(datos.tags)) tags = datos.tags;
    else if (Array.isArray(datos.etiquetas)) tags = datos.etiquetas;
    else tags = ['nuevo'];

    // 6. Construir documento polimórfico
    const nuevaIncidencia = {
      codigo: nuevoCodigo,
      titulo: datos.titulo || 'Incidencia sin título',
      descripcion: datos.descripcion || 'Sin descripción detallada',
      categoria: categoria,
      prioridad: prioridad,
      estado: "abierta",
      horas_invertidas_totales: 0,
      reportante: {
        auth_uid: req.usuario.auth_uid,
        primer_nombre: req.usuario.primer_nombre,
        apellido_paterno: req.usuario.apellido_paterno,
        rol: "reportante",
        perfil: req.usuario.perfil || "docente"
      },
      historial_seguimiento: [{
        fecha: new Date(),
        actor: {
          auth_uid: req.usuario.auth_uid,
          primer_nombre: req.usuario.primer_nombre,
          apellido_paterno: req.usuario.apellido_paterno,
          rol: req.usuario.rol
        },
        tipo: "creacion",
        accion: evidencias_adjuntas.length > 0 ? "Incidencia registrada con evidencia" : "Incidencia registrada"
      }],
      fecha_creacion: new Date(),
      detalle_especifico: detalle_especifico,
      tags: tags
    };

    if (ubicacion) {
      nuevaIncidencia.ubicacion = ubicacion;
    }

    if (evidencias_adjuntas.length > 0) {
      nuevaIncidencia.evidencias_adjuntas = evidencias_adjuntas;
    }

    // 7. Insertar en MongoDB Atlas
    await db.collection('incidencias_campus').insertOne(nuevaIncidencia);

    res.status(201).json({
      mensaje: 'Incidencia creada con éxito',
      codigo: nuevoCodigo,
      incidencia: nuevaIncidencia,
      url_evidencia: evidencias_adjuntas.length > 0 ? evidencias_adjuntas[0].url_storage : null,
      total_evidencias: evidencias_adjuntas.length
    });

  } catch (error) {
    console.error("Error crítico al crear incidencia:", error);
    res.status(500).json({ error: 'Error al procesar la solicitud', detalle: error.message });
  }
}

async function actualizarEstadoIncidencia(req, res) {
  try {
    const db = getDB();
    const { codigo } = req.params;
    let { estado_nuevo, accion, horas_invertidas, tecnico_asignado, eliminar_evidencias } = req.body;

    // 1. Buscar la incidencia actual
    const incidencia = await db.collection('incidencias_campus').findOne({ codigo });
    if (!incidencia) {
      return res.status(404).json({ error: 'Incidencia no encontrada' });
    }

    // Normalizar estado
    if (estado_nuevo) {
      estado_nuevo = estado_nuevo.toLowerCase().trim();
    } else {
      estado_nuevo = incidencia.estado;
    }

    const estado_previo = incidencia.estado;
    const horasNum = Number(horas_invertidas !== undefined && horas_invertidas !== null ? horas_invertidas : 0);
    if (isNaN(horasNum) || horasNum < 0 || horasNum > 24) {
      return res.status(400).json({ error: 'Las horas invertidas deben ser un valor numérico válido entre 0 y 24 horas por actualización.' });
    }

    // 2. Historial de seguimiento
    const nuevoEvento = {
      fecha: new Date(),
      actor: {
        auth_uid: req.usuario.auth_uid,
        primer_nombre: req.usuario.primer_nombre,
        apellido_paterno: req.usuario.apellido_paterno,
        rol: req.usuario.rol
      },
      tipo: "cambio_estado",
      accion: accion || `Estado actualizado a ${estado_nuevo}`,
      estado_previo: estado_previo,
      estado_nuevo: estado_nuevo
    };

    if (horasNum > 0) {
      nuevoEvento.horas_invertidas = horasNum;
    }

    // 3. Preparar campos de actualización
    const actualizacion = {
      $set: { estado: estado_nuevo },
      $push: { historial_seguimiento: nuevoEvento }
    };

    // 3.1 Si se especificaron evidencias para eliminar (RF-03)
    if (eliminar_evidencias && (Array.isArray(eliminar_evidencias) ? eliminar_evidencias.length > 0 : Boolean(eliminar_evidencias))) {
      const urlsParaEliminar = Array.isArray(eliminar_evidencias) ? eliminar_evidencias : [eliminar_evidencias];
      
      actualizacion.$pull = {
        evidencias_adjuntas: {
          url_storage: { $in: urlsParaEliminar }
        }
      };

      nuevoEvento.accion += ` · Se eliminó(ron) ${urlsParaEliminar.length} imagen(es) de evidencia`;

      // Intentar eliminar de Cloudinary de forma asíncrona
      if (Array.isArray(incidencia.evidencias_adjuntas)) {
        for (const ev of incidencia.evidencias_adjuntas) {
          if (urlsParaEliminar.includes(ev.url_storage)) {
            const publicId = ev.public_id || (ev.url_storage ? ev.url_storage.split('/').pop().split('.')[0] : null);
            if (publicId) {
              cloudinary.uploader.destroy(`utm_desk_evidencias/${publicId}`).catch(() => {
                cloudinary.uploader.destroy(publicId).catch(() => {});
              });
            }
          }
        }
      }
    }

    // Si se asignó un técnico
    if (tecnico_asignado && typeof tecnico_asignado === 'object' && tecnico_asignado.auth_uid) {
      const tec = await db.collection('roles').findOne({
        auth_uid: tecnico_asignado.auth_uid,
        rol: 'tecnico',
        activo: { $ne: false }
      });
      if (tec) {
        actualizacion.$set.tecnico_asignado = {
          auth_uid: tec.auth_uid || tec._id.toString(),
          primer_nombre: tec.primer_nombre,
          apellido_paterno: tec.apellido_paterno,
          rol: "tecnico"
        };
      }
    } else if (typeof tecnico_asignado === 'string' && tecnico_asignado.trim()) {
      // Compatibilidad: buscar técnico por nombre completo o nombre_usuario
      const nombreBuscado = tecnico_asignado.trim();
      const tec = await db.collection('roles').findOne({
        rol: 'tecnico',
        activo: { $ne: false },
        $or: [
          { primer_nombre: { $regex: new RegExp(nombreBuscado, 'i') } },
          { nombre_usuario: { $regex: new RegExp(nombreBuscado, 'i') } }
        ]
      });
      if (tec) {
        actualizacion.$set.tecnico_asignado = {
          auth_uid: tec.auth_uid,
          primer_nombre: tec.primer_nombre,
          apellido_paterno: tec.apellido_paterno,
          rol: "tecnico"
        };
      }
    }

    // Si se resuelve o cierra
    if (estado_nuevo === "resuelta" || estado_nuevo === "cerrada") {
      actualizacion.$set.fecha_resolucion = new Date();
      if (horasNum > 0) {
        actualizacion.$inc = { horas_invertidas_totales: horasNum };
      }
    } else if (horasNum > 0) {
      actualizacion.$inc = { horas_invertidas_totales: horasNum };
    }

    // 4. Actualizar en MongoDB
    await db.collection('incidencias_campus').updateOne(
      { codigo },
      actualizacion
    );

    res.json({ mensaje: 'Estado actualizado correctamente', codigo, estado: estado_nuevo });
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    res.status(500).json({ error: 'Error al procesar la actualización', detalle: error.message });
  }
}

async function obtenerEstadisticasDashboard(req, res) {
  try {
    const db = getDB();

    const pipeline = [
      {
        $facet: {
          "total_incidencias": [{ $count: "total" }],
          "por_estado": [{ $group: { _id: "$estado", cantidad: { $sum: 1 } } }],
          "por_categoria": [{ $group: { _id: "$categoria", cantidad: { $sum: 1 } } }],
          "horas_totales": [{ $group: { _id: null, total_horas: { $sum: "$horas_invertidas_totales" } } }],
          "horas_por_edificio": [
            { $match: { estado: { $in: ["resuelta", "cerrada"] }, "ubicacion.edificio": { $exists: true } } },
            { $group: { _id: "$ubicacion.edificio", promedio_horas: { $avg: "$horas_invertidas_totales" } } },
            { $sort: { promedio_horas: -1 } }
          ],
          "top_tags": [
            { $unwind: "$tags" },
            { $group: { _id: "$tags", total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ];

    const resultados = await db.collection('incidencias_campus').aggregate(pipeline).toArray();
    const data = resultados[0];

    const estadisticas = {
      total: data.total_incidencias[0] ? data.total_incidencias[0].total : 0,
      horas_tecnicas_invertidas: data.horas_totales[0] ? Number(data.horas_totales[0].total_horas.toFixed(1)) : 0,
      desglose_estados: data.por_estado,
      desglose_categorias: data.por_categoria,
      horas_por_edificio: data.horas_por_edificio.map(item => ({
        edificio: item._id,
        promedio_horas: Number(item.promedio_horas.toFixed(1))
      })),
      top_tags: data.top_tags.map(item => ({
        tag: item._id,
        cantidad: item.total
      }))
    };

    res.json(estadisticas);
  } catch (error) {
    console.error("Error al generar analíticas:", error);
    res.status(500).json({ error: 'Error al procesar el dashboard' });
  }
}

async function eliminarEvidenciaIndividual(req, res) {
  try {
    const db = getDB();
    const { codigo } = req.params;
    const { url_storage } = req.body;

    if (!url_storage) {
      return res.status(400).json({ error: 'Debes proporcionar la URL de la evidencia a eliminar' });
    }

    const incidencia = await db.collection('incidencias_campus').findOne({ codigo });
    if (!incidencia) {
      return res.status(404).json({ error: 'Incidencia no encontrada' });
    }

    const nuevoEvento = {
      fecha: new Date(),
      actor: {
        auth_uid: req.usuario.auth_uid,
        primer_nombre: req.usuario.primer_nombre,
        apellido_paterno: req.usuario.apellido_paterno,
        rol: req.usuario.rol
      },
      tipo: "eliminacion_evidencia",
      accion: "Se eliminó una imagen de evidencia de la incidencia",
      estado_previo: incidencia.estado,
      estado_nuevo: incidencia.estado
    };

    await db.collection('incidencias_campus').updateOne(
      { codigo },
      {
        $pull: { evidencias_adjuntas: { url_storage } },
        $push: { historial_seguimiento: nuevoEvento }
      }
    );

    // Intentar eliminar de Cloudinary
    if (Array.isArray(incidencia.evidencias_adjuntas)) {
      const ev = incidencia.evidencias_adjuntas.find(e => e.url_storage === url_storage);
      if (ev) {
        const publicId = ev.public_id || (ev.url_storage ? ev.url_storage.split('/').pop().split('.')[0] : null);
        if (publicId) {
          cloudinary.uploader.destroy(`utm_desk_evidencias/${publicId}`).catch(() => {
            cloudinary.uploader.destroy(publicId).catch(() => {});
          });
        }
      }
    }

    res.json({ mensaje: 'Evidencia eliminada correctamente', codigo, url_storage });
  } catch (error) {
    console.error('Error al eliminar evidencia individual:', error);
    res.status(500).json({ error: 'Error al eliminar evidencia', detalle: error.message });
  }
}

module.exports = {
  obtenerIncidencias,
  crearIncidencia,
  actualizarEstadoIncidencia,
  obtenerEstadisticasDashboard,
  eliminarEvidenciaIndividual
};