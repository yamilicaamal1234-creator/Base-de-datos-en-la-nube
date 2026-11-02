require('dotenv').config();
const { MongoClient } = require('mongodb');

async function poblarIncidencias() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    // 1. ELIMINAR COLECCIÓN VIEJA PARA DESTRUIR EL VALIDADOR ANTIGUO
    try {
      await db.collection('incidencias_campus').drop();
      console.log("🗑️ Colección antigua eliminada.");
    } catch (e) {
      console.log("La colección no existía o ya estaba limpia.");
    }

    // 2. CREAR COLECCIÓN NUEVA CON EL VALIDADOR FINAL (ANEXO B)
    await db.createCollection('incidencias_campus', {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: [
            "codigo", "titulo", "descripcion", "categoria", "prioridad",
            "estado", "horas_invertidas_totales", "reportante",
            "historial_seguimiento", "fecha_creacion", "detalle_especifico"
          ],
          properties: {
            _id: { bsonType: "objectId" },
            codigo: { bsonType: "string", minLength: 1 },
            titulo: { bsonType: "string", minLength: 1 },
            descripcion: { bsonType: "string", minLength: 1 },
            categoria: { enum: ["redes", "infraestructura", "academico"] },
            prioridad: { enum: ["baja", "media", "alta", "critica"] },
            estado: { enum: ["abierta", "en proceso", "en espera", "resuelta", "cerrada"] },
            horas_invertidas_totales: { bsonType: ["double", "int", "long", "decimal"], minimum: 0 },
            fecha_creacion: { bsonType: "date" },
            fecha_resolucion: { bsonType: "date" },
            tags: { bsonType: "array", items: { bsonType: "string" } },
            reportante: {
              bsonType: "object",
              required: ["auth_uid", "primer_nombre", "apellido_paterno", "rol"],
              additionalProperties: false,
              properties: {
                auth_uid: { bsonType: "string", minLength: 1 },
                primer_nombre: { bsonType: "string", minLength: 1 },
                segundo_nombre: { bsonType: "string" },
                apellido_paterno: { bsonType: "string", minLength: 1 },
                apellido_materno: { bsonType: "string" },
                rol: { enum: ["reportante"] },
                perfil: { enum: ["estudiante", "docente", "personal_administrativo"] }
              }
            },
            tecnico_asignado: {
              bsonType: "object",
              required: ["auth_uid", "primer_nombre", "apellido_paterno", "rol"],
              additionalProperties: false,
              properties: {
                auth_uid: { bsonType: "string", minLength: 1 },
                primer_nombre: { bsonType: "string", minLength: 1 },
                segundo_nombre: { bsonType: "string" },
                apellido_paterno: { bsonType: "string", minLength: 1 },
                apellido_materno: { bsonType: "string" },
                rol: { enum: ["tecnico"] }
              }
            },
            ubicacion: {
              bsonType: "object",
              required: ["edificio", "zona"],
              additionalProperties: false,
              properties: {
                edificio: { bsonType: "string", minLength: 1 },
                zona: { bsonType: "string", minLength: 1 }
              }
            },
            detalle_especifico: { bsonType: "object" },
            historial_seguimiento: {
              bsonType: "array",
              minItems: 1,
              items: {
                bsonType: "object",
                required: ["fecha", "actor", "tipo", "accion"],
                additionalProperties: false,
                properties: {
                  fecha: { bsonType: "date" },
                  actor: {
                    bsonType: "object",
                    required: ["auth_uid", "primer_nombre", "apellido_paterno", "rol"],
                    additionalProperties: false,
                    properties: {
                      auth_uid: { bsonType: "string", minLength: 1 },
                      primer_nombre: { bsonType: "string", minLength: 1 },
                      segundo_nombre: { bsonType: "string" },
                      apellido_paterno: { bsonType: "string", minLength: 1 },
                      apellido_materno: { bsonType: "string" },
                      rol: { enum: ["reportante", "tecnico", "coordinador", "directivo", "administrador"] }
                    }
                  },
                  tipo: { enum: ["creacion", "nota", "cambio_estado"] },
                  accion: { bsonType: "string", minLength: 1 },
                  horas_invertidas: { bsonType: ["double", "int", "long", "decimal"], minimum: 0 },
                  estado_previo: { enum: ["abierta", "en proceso", "en espera", "resuelta", "cerrada"] },
                  estado_nuevo: { enum: ["abierta", "en proceso", "en espera", "resuelta", "cerrada"] }
                },
                anyOf: [
                  { properties: { tipo: { enum: ["creacion", "nota"] } }, not: { anyOf: [{ required: ["estado_previo"] }, { required: ["estado_nuevo"] }] } },
                  { required: ["estado_previo", "estado_nuevo"], properties: { tipo: { enum: ["cambio_estado"] } } }
                ]
              }
            },
            evidencias_adjuntas: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["nombre_archivo", "tipo_mime", "peso_kb", "url_storage", "fecha_carga"],
                additionalProperties: false,
                properties: {
                  nombre_archivo: { bsonType: "string", minLength: 1 },
                  tipo_mime: { bsonType: "string", minLength: 1 },
                  peso_kb: { bsonType: ["int", "long", "double", "decimal"], minimum: 0 },
                  url_storage: { bsonType: "string", minLength: 1 },
                  fecha_carga: { bsonType: "date" }
                }
              }
            }
          },
          allOf: [
            {
              anyOf: [
                {
                  properties: {
                    categoria: { enum: ["redes"] },
                    detalle_especifico: {
                      bsonType: "object",
                      required: ["tipo_equipo"],
                      additionalProperties: false,
                      properties: {
                        tipo_equipo: { bsonType: "string", minLength: 1 },
                        direccion_ip: { bsonType: "string" },
                        vlan: { bsonType: "string" },
                        puerto_conexion: { bsonType: "string" }
                      }
                    }
                  },
                  required: ["ubicacion"]
                },
                {
                  properties: {
                    categoria: { enum: ["infraestructura"] },
                    detalle_especifico: {
                      bsonType: "object",
                      required: ["tipo_dano", "nivel_riesgo", "riesgo_descripcion", "requiere_contratista_externo"],
                      additionalProperties: false,
                      properties: {
                        tipo_dano: { bsonType: "string", minLength: 1 },
                        nivel_riesgo: { enum: ["bajo", "medio", "alto", "critico"] },
                        riesgo_descripcion: { bsonType: "string", minLength: 1 },
                        requiere_contratista_externo: { bsonType: "bool" },
                        insumos_requeridos: { bsonType: "array", items: { bsonType: "string" } }
                      }
                    }
                  },
                  required: ["ubicacion"]
                },
                {
                  properties: {
                    categoria: { enum: ["academico"] },
                    detalle_especifico: {
                      bsonType: "object",
                      required: ["plataforma", "periodo_escolar"],
                      additionalProperties: false,
                      properties: {
                        plataforma: { bsonType: "string", minLength: 1 },
                        periodo_escolar: { bsonType: "string", minLength: 1 },
                        estudiantes_afectados: { bsonType: ["int", "long"], minimum: 0 }
                      }
                    }
                  },
                  not: { required: ["ubicacion"] }
                }
              ]
            },
            {
              anyOf: [
                {
                  required: ["fecha_resolucion"],
                  properties: { estado: { enum: ["resuelta", "cerrada"] } }
                },
                {
                  properties: { estado: { enum: ["abierta", "en proceso", "en espera"] } },
                  not: { required: ["fecha_resolucion"] }
                }
              ]
            }
          ]
        }
      },
      validationLevel: "strict",
      validationAction: "error"
    });
    console.log("✅ Colección y validador creados desde cero.");

    // 3. RECREAR LOS ÍNDICES OBLIGATORIOS (ANEXO A)
    const coleccion = db.collection('incidencias_campus');
    await coleccion.createIndex({ codigo: 1 }, { unique: true, name: "uq_incidencia_codigo" });
    await coleccion.createIndex({ categoria: 1, estado: 1, "ubicacion.edificio": 1 }, { name: "ix_categoria_estado_edificio" });
    await coleccion.createIndex({ titulo: "text", descripcion: "text" }, { default_language: "spanish", name: "txt_titulo_descripcion" });
    await coleccion.createIndex({ fecha_resolucion: 1 }, { expireAfterSeconds: 5184000, name: "ttl_fecha_resolucion_60d" });
    console.log("✅ Índices creados exitosamente.");

    // 4. INYECTAR LOS DATOS
    const reportanteBase = { auth_uid: "uid-demo-rep", primer_nombre: "Juan", apellido_paterno: "Perez", rol: "reportante", perfil: "estudiante" };
    const actorBase = { auth_uid: "uid-demo-rep", primer_nombre: "Juan", apellido_paterno: "Perez", rol: "reportante" };
    const tecnicoBase = { auth_uid: "uid-demo-tec", primer_nombre: "Ana", apellido_paterno: "Lopez", rol: "tecnico" };

    const documentos = [];

    for (let i = 1; i <= 10; i++) {
      let estado = i % 2 === 0 ? "resuelta" : "en proceso";
      let doc = {
        codigo: `INC-RED-00${i}`,
        titulo: `Falla de red en equipo ${i}`,
        descripcion: `El equipo no obtiene IP y el switch no responde. Reporte sintético ${i}.`,
        categoria: "redes",
        prioridad: "alta",
        estado: estado,
        horas_invertidas_totales: estado === "resuelta" ? 3.5 : 0,
        fecha_creacion: new Date(),
        reportante: reportanteBase,
        ubicacion: { edificio: `Edificio ${i % 3 === 0 ? 'A' : 'B'}`, zona: `Laboratorio ${i}` },
        detalle_especifico: { tipo_equipo: "Switch de acceso", direccion_ip: `192.168.10.${i}`, vlan: "20" },
        tags: ["switch", "sin-red"],
        historial_seguimiento: [{ fecha: new Date(), actor: actorBase, tipo: "creacion", accion: "Incidencia registrada" }]
      };
      if (estado === "resuelta") {
        doc.fecha_resolucion = new Date();
        doc.tecnico_asignado = tecnicoBase;
        doc.historial_seguimiento.push({ fecha: new Date(), actor: tecnicoBase, tipo: "cambio_estado", accion: "Puerto restablecido", horas_invertidas: 3.5, estado_previo: "en proceso", estado_nuevo: "resuelta" });
      }
      documentos.push(doc);
    }

    for (let i = 11; i <= 20; i++) {
      let estado = i % 2 === 0 ? "cerrada" : "abierta";
      let doc = {
        codigo: `INC-INF-00${i}`,
        titulo: `Daño de infraestructura zona ${i}`,
        descripcion: `Filtración de agua reportada en techo. Reporte sintético ${i}.`,
        categoria: "infraestructura",
        prioridad: "media",
        estado: estado,
        horas_invertidas_totales: estado === "cerrada" ? 5 : 0,
        fecha_creacion: new Date(),
        reportante: reportanteBase,
        ubicacion: { edificio: `Edificio ${i % 2 === 0 ? 'C' : 'A'}`, zona: `Pasillo ${i}` },
        detalle_especifico: { tipo_dano: "Humedad estructural", nivel_riesgo: "medio", riesgo_descripcion: "Riesgo de resbalones", requiere_contratista_externo: false },
        tags: ["filtracion", "techo", "humedad"],
        historial_seguimiento: [{ fecha: new Date(), actor: actorBase, tipo: "creacion", accion: "Incidencia registrada" }]
      };
      if (estado === "cerrada") {
        doc.fecha_resolucion = new Date();
        doc.tecnico_asignado = tecnicoBase;
        doc.historial_seguimiento.push({ fecha: new Date(), actor: tecnicoBase, tipo: "cambio_estado", accion: "Impermeabilización lista", horas_invertidas: 5, estado_previo: "resuelta", estado_nuevo: "cerrada" });
      }
      documentos.push(doc);
    }

    for (let i = 21; i <= 30; i++) {
      let doc = {
        codigo: `INC-ACA-00${i}`,
        titulo: `Falla de plataforma académica ${i}`,
        descripcion: `Alumnos sin acceso al curso. Reporte sintético ${i}.`,
        categoria: "academico",
        prioridad: "media",
        estado: "abierta",
        horas_invertidas_totales: 0,
        fecha_creacion: new Date(),
        reportante: reportanteBase,
        detalle_especifico: { plataforma: "Moodle institucional", periodo_escolar: "Septiembre-Diciembre 2026" },
        tags: ["moodle", "acceso", "matricula"],
        historial_seguimiento: [{ fecha: new Date(), actor: actorBase, tipo: "creacion", accion: "Incidencia registrada" }]
      };
      documentos.push(doc);
    }

    await coleccion.insertMany(documentos);
    console.log(`✅ ¡30 incidencias sintéticas insertadas con éxito!`);
  } catch (error) {
    console.error('❌ Error crítico:', error);
  } finally {
    await client.close();
  }
}

poblarIncidencias();