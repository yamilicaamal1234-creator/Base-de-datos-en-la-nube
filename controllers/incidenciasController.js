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

    // 2. Subir archivo a Cloudinary si se adjuntó evidencia
    let evidencias_adjuntas = [];
    if (req.file) {
      const subida = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "utm_desk_evidencias", resource_type: "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      evidencias_adjuntas.push({
        nombre_archivo: req.file.originalname,
        tipo_mime: req.file.mimetype,
        peso_kb: Math.round(req.file.size / 1024),
        url_storage: subida.secure_url,
        fecha_carga: new Date()
      });
    }

    // 3. Generar código único secuencial
    const count = await db.collection('incidencias_campus').countDocuments();
    const nuevoCodigo = `INC-2026-${(count + 1).toString().padStart(4, '0')}`;

    // 4. Adaptar detalle_especifico y ubicación según la categoría estricta de MongoDB
    let detalle_especifico = {};
    let ubicacion = null;

    const detIn = datos.detalle_especifico || {};

    if (categoria === 'redes') {
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
      let nivelRiesgo = (detIn.nivel_riesgo || 'medio').toLowerCase().trim();
      nivelRiesgo = nivelRiesgo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!['bajo', 'medio', 'alto', 'critico'].includes(nivelRiesgo)) nivelRiesgo = 'medio';

      let insumos = [];
      if (Array.isArray(detIn.insumos_requeridos)) {
        insumos = detIn.insumos_requeridos;
      } else if (Array.isArray(detIn.insumos)) {
        insumos = detIn.insumos;
      } else if (typeof detIn.insumos === 'string' && detIn.insumos.trim()) {
        insumos = detIn.insumos.split(',').map(s => s.trim()).filter(Boolean);
      }

      detalle_especifico = {
        tipo_dano: detIn.tipo_dano || detIn.tipo_danio || 'Mobiliario',
        nivel_riesgo: nivelRiesgo,
        riesgo_descripcion: detIn.riesgo_descripcion || detIn.descripcion_riesgo || 'Daño reportado en instalaciones',
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
      detalle_especifico = {
        plataforma: detIn.plataforma || 'Moodle',
        periodo_escolar: detIn.periodo_escolar || detIn.periodo || 'Sep–Dic 2026'
      };
      if (detIn.estudiantes_afectados !== undefined && detIn.estudiantes_afectados !== null && detIn.estudiantes_afectados !== '') {
        detalle_especifico.estudiantes_afectados = Math.max(0, parseInt(detIn.estudiantes_afectados, 10) || 0);
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
      url_evidencia: evidencias_adjuntas.length > 0 ? evidencias_adjuntas[0].url_storage : null
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
    let { estado_nuevo, accion, horas_invertidas, tecnico_asignado } = req.body;

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
    const horasNum = Number(horas_invertidas) || 0;

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

    // Si se asignó un técnico
    if (tecnico_asignado && typeof tecnico_asignado === 'object' && tecnico_asignado.auth_uid) {
      actualizacion.$set.tecnico_asignado = {
        auth_uid: tecnico_asignado.auth_uid,
        primer_nombre: tecnico_asignado.primer_nombre,
        apellido_paterno: tecnico_asignado.apellido_paterno,
        rol: "tecnico"
      };
    } else if (typeof tecnico_asignado === 'string' && tecnico_asignado.trim()) {
      // Buscar técnico por nombre
      const tec = await db.collection('roles').findOne({
        rol: 'tecnico',
        $or: [
          { primer_nombre: { $regex: new RegExp(tecnico_asignado.trim(), 'i') } },
          { nombre_usuario: { $regex: new RegExp(tecnico_asignado.trim(), 'i') } }
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

module.exports = {
  obtenerIncidencias,
  crearIncidencia,
  actualizarEstadoIncidencia,
  obtenerEstadisticasDashboard
};