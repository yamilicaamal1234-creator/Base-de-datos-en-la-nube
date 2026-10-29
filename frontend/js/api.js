/* =========================================================
   UTM Desk NoSQL Cloud — API Client Service
   Conexión con el Backend Node.js / Express y MongoDB Atlas
   ========================================================= */

const API_BASE_URL = 'https://utm-desk-t096.onrender.com/api';

/** Obtiene el token JWT almacenado */
function getToken() {
    return localStorage.getItem('utm_token') || '';
}

/** Guarda el token JWT y los datos del usuario */
function setSession(token, usuario) {
    if (token) localStorage.setItem('utm_token', token);
    if (usuario) localStorage.setItem('utm_user', JSON.stringify(usuario));
}

/** Limpia la sesión actual */
function clearSession() {
    localStorage.removeItem('utm_token');
    localStorage.removeItem('utm_user');
}

/** Wrapper para realizar peticiones HTTP a la API */
async function apiFetch(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getToken();

    const headers = { ...options.headers };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Si el body no es FormData, agregamos Content-Type application/json
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMsg = data.error || data.mensaje || `Error HTTP ${response.status}`;
            throw new Error(errorMsg);
        }

        return data;
    } catch (err) {
        console.error(`[API Error] ${endpoint}:`, err);
        throw err;
    }
}

// ----------------- Métodos de API -----------------

/** Iniciar sesión */
async function apiLogin(email, password = '') {
    return await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}

/** Obtener perfil autenticado */
async function apiGetPerfil() {
    return await apiFetch('/auth/perfil');
}

/** Obtener todas las incidencias (filtradas automáticamente por rol en el backend) */
async function apiGetIncidencias() {
    const data = await apiFetch('/incidencias');
    return data.map(normalizarIncidenciaParaFrontend);
}

/** Crear nueva incidencia (soporta FormData con archivo real para Cloudinary) */
async function apiCrearIncidencia(formData) {
    return await apiFetch('/incidencias', {
        method: 'POST',
        body: formData,
    });
}

/** Actualizar estado de una incidencia (RF-03) */
async function apiActualizarEstado(codigo, payload) {
    return await apiFetch(`/incidencias/${encodeURIComponent(codigo)}/estado`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

/** Obtener estadísticas calculadas en tiempo real por MongoDB Aggregation */
async function apiGetEstadisticas() {
    return await apiFetch('/incidencias/dashboard/estadisticas');
}

/** Listar usuarios institucionales para administración */
async function apiGetUsuarios() {
    return await apiFetch('/auth/usuarios');
}

/** Crear usuario institucional */
async function apiCrearUsuario(payload) {
    return await apiFetch('/auth/usuarios', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/** Actualizar rol o estado de un usuario */
async function apiActualizarUsuario(auth_uid, payload) {
    return await apiFetch(`/auth/usuarios/${encodeURIComponent(auth_uid)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

// ----------------- Normalización de Datos -----------------

const FORMATO_ESTADO = {
    'abierta': 'Abierta',
    'en proceso': 'En proceso',
    'en espera': 'En espera',
    'resuelta': 'Resuelta',
    'cerrada': 'Cerrada',
};

const FORMATO_PRIORIDAD = {
    'baja': 'Baja',
    'media': 'Media',
    'alta': 'Alta',
    'critica': 'Crítica',
};

/** Mapea el documento estricto de MongoDB al formato consumido por la interfaz */
function normalizarIncidenciaParaFrontend(doc) {
    const estadoRaw = (doc.estado || 'abierta').toLowerCase();
    const prioridadRaw = (doc.prioridad || 'media').toLowerCase();

    const categoriaUI = doc.categoria === 'infraestructura' ? 'infra' : (doc.categoria || 'redes');

    const tecNombre = doc.tecnico_asignado
        ? `${doc.tecnico_asignado.primer_nombre} ${doc.tecnico_asignado.apellido_paterno}`.trim()
        : 'Sin asignar';

    const repNombre = doc.reportante
        ? `${doc.reportante.primer_nombre} ${doc.reportante.apellido_paterno}`.trim()
        : 'Usuario';

    let edificio = 'Sin especificar';
    if (doc.ubicacion && doc.ubicacion.edificio) {
        edificio = doc.ubicacion.edificio;
    } else if (doc.categoria === 'academico') {
        edificio = 'Campus Virtual';
    }

    return {
        id: doc.codigo,
        titulo: doc.titulo || 'Sin título',
        descripcion: doc.descripcion || '',
        categoria: categoriaUI,
        prioridad: FORMATO_PRIORIDAD[prioridadRaw] || 'Media',
        estado: FORMATO_ESTADO[estadoRaw] || 'Abierta',
        edificio: edificio,
        zona: doc.ubicacion?.zona || '',
        tags: Array.isArray(doc.tags) && doc.tags.length ? doc.tags : ['incidencia'],
        reportante: repNombre,
        tecnico: tecNombre,
        tecnico_asignado: doc.tecnico_asignado || null,
        horas: Number(doc.horas_invertidas_totales || 0),
        fecha: doc.fecha_creacion ? new Date(doc.fecha_creacion).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        evidencias: doc.evidencias_adjuntas || [],
        detalle_especifico: doc.detalle_especifico || {},
        historial_seguimiento: doc.historial_seguimiento || [],
    };
}
