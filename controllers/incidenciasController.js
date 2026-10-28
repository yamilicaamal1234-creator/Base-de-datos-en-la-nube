const { getDB } = require('../config/db');
const { cloudinary } = require('../config/cloudinary');

async function obtenerIncidencias(req, res) {
  try {
    const db = getDB();
    let filtro = {};

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
    // Parseamos el JSON que vendrá incrustado en el form-data
    const datos = JSON.parse(req.body.datos);
    
    // 1. Subir la imagen a Cloudinary si el usuario adjuntó una (RF-02)
    let evidencias_adjuntas = [];
    if (req.file) {
      const subida = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "utm_desk_evidencias" },
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
        peso_kb: Math.round(req.file.size / 1024), // Guardamos solo metadatos y URL
        url_storage: subida.secure_url,
        fecha_carga: new Date()
      });
    }

    // 2. Generar un código único
    const count = await db.collection('incidencias_campus').countDocuments();
    const nuevoCodigo = `INC-2026-${(count + 1).toString().padStart(4, '0')}`;

    // 3. Construir el documento polimórfico (RF-01) respetando el esquema estricto
    const nuevaIncidencia = {
      codigo: nuevoCodigo,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      categoria: datos.categoria,
      prioridad: datos.prioridad,
      estado: "abierta",
      horas_invertidas_totales: 0,
      reportante: {
        auth_uid: req.usuario.auth_uid,
        primer_nombre: req.usuario.primer_nombre,
        apellido_paterno: req.usuario.apellido_paterno,
        rol: "reportante", // Forzado para cumplir el validador del reportante
        perfil: "docente" 
      },
      historial_seguimiento: [{
        fecha: new Date(),
        actor: {
          auth_uid: req.usuario.auth_uid,
          primer_nombre: req.usuario.primer_nombre,
          apellido_paterno: req.usuario.apellido_paterno,
          rol: req.usuario.rol // Aquí sí se usa el rol real del usuario logueado
        },
        tipo: "creacion",
        accion: "Incidencia registrada con evidencia"
      }],
      fecha_creacion: new Date(),
      detalle_especifico: datos.detalle_especifico
    };

    // Campos opcionales / condicionales
    if (datos.ubicacion) nuevaIncidencia.ubicacion = datos.ubicacion;
    if (datos.tags) nuevaIncidencia.tags = datos.tags;
    if (evidencias_adjuntas.length > 0) nuevaIncidencia.evidencias_adjuntas = evidencias_adjuntas;

    // 4. Insertar en MongoDB Atlas
    const resultado = await db.collection('incidencias_campus').insertOne(nuevaIncidencia);
    
    res.status(201).json({ 
      mensaje: 'Incidencia creada y evidencia subida con éxito', 
      codigo: nuevoCodigo,
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
    const { estado_nuevo, accion, horas_invertidas } = req.body;

    // 1. Buscar la incidencia actual para saber su estado previo
    const incidencia = await db.collection('incidencias_campus').findOne({ codigo });
    if (!incidencia) {
      return res.status(404).json({ error: 'Incidencia no encontrada' });
    }

    const estado_previo = incidencia.estado;

    // 2. Construir el nuevo evento para el historial
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

    if (horas_invertidas) {
      nuevoEvento.horas_invertidas = Number(horas_invertidas);
    }

    // 3. Preparar los datos a actualizar en el documento principal
    const actualizacion = {
      $set: { estado: estado_nuevo },
      $push: { historial_seguimiento: nuevoEvento }
    };

    // Si se resuelve o cierra, sumamos horas y ponemos fecha de resolución
    if (estado_nuevo === "resuelta" || estado_nuevo === "cerrada") {
      actualizacion.$set.fecha_resolucion = new Date();
      if (horas_invertidas) {
        actualizacion.$inc = { horas_invertidas_totales: Number(horas_invertidas) };
      }
    }

    // 4. Ejecutar la actualización en MongoDB
    const resultado = await db.collection('incidencias_campus').updateOne(
      { codigo },
      actualizacion
    );

    res.json({ mensaje: 'Estado actualizado correctamente', codigo });
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    res.status(500).json({ error: 'Error al procesar la actualización', detalle: error.message });
  }
}
async function obtenerEstadisticasDashboard(req, res) {
  try {
    const db = getDB();
    
    // Usamos el Aggregation Framework de MongoDB para calcular todo en una sola consulta
    const pipeline = [
      {
        $facet: {
          "total_incidencias": [ { $count: "total" } ],
          "por_estado": [ { $group: { _id: "$estado", cantidad: { $sum: 1 } } } ],
          "por_categoria": [ { $group: { _id: "$categoria", cantidad: { $sum: 1 } } } ],
          "horas_totales": [ { $group: { _id: null, total_horas: { $sum: "$horas_invertidas_totales" } } } ]
        }
      }
    ];

    const resultados = await db.collection('incidencias_campus').aggregate(pipeline).toArray();
    const data = resultados[0];

    // Formateamos la respuesta para que el frontend la consuma fácilmente
    const estadisticas = {
      total: data.total_incidencias[0] ? data.total_incidencias[0].total : 0,
      horas_tecnicas_invertidas: data.horas_totales[0] ? data.horas_totales[0].total_horas : 0,
      desglose_estados: data.por_estado,
      desglose_categorias: data.por_categoria
    };

    res.json(estadisticas);
  } catch (error) {
    console.error("Error al generar analíticas:", error);
    res.status(500).json({ error: 'Error al procesar el dashboard' });
  }
}
module.exports = { obtenerIncidencias, crearIncidencia, actualizarEstadoIncidencia, obtenerEstadisticasDashboard };