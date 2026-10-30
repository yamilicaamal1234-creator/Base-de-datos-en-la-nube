/* =========================================================
   UTM Desk NoSQL Cloud — App Core & Catalogs (Vanilla JS)
   ========================================================= */

// ---------- Catálogos ----------
const ESTADOS = ['Abierta', 'En proceso', 'En espera', 'Resuelta', 'Cerrada'];
const ESTADO_STYLE = {
    'Abierta': { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200', color: '#0ea5e9', icon: 'fa-folder-open' },
    'En proceso': { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200', color: '#f59e0b', icon: 'fa-gears' },
    'En espera': { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-200', color: '#8b5cf6', icon: 'fa-hourglass-half' },
    'Resuelta': { dot: 'bg-green-600', chip: 'bg-green-50 text-green-700 ring-green-200', color: '#16a34a', icon: 'fa-circle-check' },
    'Cerrada': { dot: 'bg-gray-500', chip: 'bg-gray-100 text-gray-600 ring-gray-200', color: '#6b7280', icon: 'fa-lock' },
};
const PRIORIDADES = [
    { v: 'Baja', cls: 'peer-checked:bg-gray-700 peer-checked:text-white peer-checked:border-gray-700', stripe: 'bg-gray-300', chip: 'text-gray-600 bg-gray-100' },
    { v: 'Media', cls: 'peer-checked:bg-sky-600 peer-checked:text-white peer-checked:border-sky-600', stripe: 'bg-sky-400', chip: 'text-sky-700 bg-sky-50' },
    { v: 'Alta', cls: 'peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500', stripe: 'bg-amber-400', chip: 'text-amber-700 bg-amber-50' },
    { v: 'Crítica', cls: 'peer-checked:bg-red-600 peer-checked:text-white peer-checked:border-red-600', stripe: 'bg-red-500', chip: 'text-red-700 bg-red-50' },
];
const CATEGORIAS = [
    { v: 'redes', label: 'Cómputo / Redes', icon: 'fa-network-wired', desc: 'Equipos, red, Wi-Fi', ring: 'peer-checked:border-green-600 peer-checked:bg-green-50', ic: 'text-green-700 bg-green-100' },
    { v: 'infra', label: 'Infraestructura', icon: 'fa-building', desc: 'Instalaciones, daños', ring: 'peer-checked:border-amber-500 peer-checked:bg-amber-50', ic: 'text-amber-700 bg-amber-100' },
    { v: 'academico', label: 'Académico', icon: 'fa-graduation-cap', desc: 'Plataformas, SIIA', ring: 'peer-checked:border-sky-500 peer-checked:bg-sky-50', ic: 'text-sky-700 bg-sky-100' },
];
const CAT_LABEL = { redes: 'Cómputo / Redes', infra: 'Infraestructura', academico: 'Académico' };
const CAT_ICON = { redes: 'fa-network-wired', infra: 'fa-building', academico: 'fa-graduation-cap' };
let TECNICOS = [];

/** Carga siempre desde MongoDB los técnicos activos disponibles para asignación. */
async function cargarTecnicosDesdeAPI() {
    try {
        const usuarios = await apiGetUsuarios();
        TECNICOS = usuarios
            .filter((u) => (u.rol || '').toLowerCase() === 'tecnico' && u.activo !== false)
            .map((u) => ({
                auth_uid: u.auth_uid || u._id?.toString(),
                primer_nombre: u.primer_nombre || '',
                apellido_paterno: u.apellido_paterno || '',
                nombre: `${u.primer_nombre || ''} ${u.apellido_paterno || ''}`.trim(),
                rol: 'tecnico'
            }))
            .filter((u) => u.auth_uid && u.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } catch (err) {
        console.warn('No se pudieron cargar los técnicos desde MongoDB:', err.message);
        TECNICOS = [];
    }
    return TECNICOS;
}

// Catálogo oficial de edificios del campus UTM
const EDIFICIOS = [
    'Edificio C',
    'Edificio J',
    'Edificio F',
    'Edificio G',
    'Edificio M',
    'Edificio T',
    'Edificio N',
    'Edificio R',
    'Vinculación',
    'Pesado 1',
    'Pesado 2',
    'Rectoría',
    'Servicios Escolares',
    'Biblioteca'
];

const USERS = {
    'Reportante': { name: 'Laura Méndez', ini: 'LM', email: 'laura.mendez@utm.edu.mx' },
    'Técnico': { name: 'Carlos Ruiz', ini: 'CR', email: 'carlos.ruiz@utm.edu.mx' },
    'Coordinador': { name: 'Mariana Chi', ini: 'MC', email: 'mariana.chi@utm.edu.mx' },
    'Directivo': { name: 'Dr. Raúl Baeza', ini: 'RB', email: 'raul.baeza@utm.edu.mx' },
    'Administrador': { name: 'Daniel Flota', ini: 'DF', email: 'daniel.flota@utm.edu.mx' },
};

// ---------- Navegación por rol ----------
const NAV = [
    { id: 'reporte', label: 'Nuevo reporte', icon: 'fa-circle-plus', sub: 'Registro polimórfico de incidencias (RF-01)', roles: ['Reportante', 'Coordinador', 'Administrador'] },
    { id: 'mis', label: 'Mis reportes', icon: 'fa-inbox', sub: 'Seguimiento de tus incidencias', roles: ['Reportante'] },
    { id: 'gestion', label: 'Gestión de incidencias', icon: 'fa-table-columns', sub: 'Tablero de trabajo y actualización atómica (RF-03)', roles: ['Técnico', 'Coordinador', 'Administrador'] },
    { id: 'analitica', label: 'Analítica', icon: 'fa-chart-simple', sub: 'Indicadores directivos (RF-06 · RF-07)', roles: ['Coordinador', 'Directivo', 'Administrador'] },
    { id: 'admin', label: 'Administración', icon: 'fa-sliders', sub: 'Usuarios, roles y servicios en la nube', roles: ['Administrador'] },
];
const DEFAULT_VIEW = { 'Reportante': 'reporte', 'Técnico': 'gestion', 'Coordinador': 'gestion', 'Directivo': 'analitica', 'Administrador': 'gestion' };

// ---------- Estado y Datos de Incidencias ----------
let tickets = [];
let currentUser = null;

/** Carga las incidencias en tiempo real desde el Backend MongoDB Atlas */
async function cargarIncidenciasDesdeAPI() {
    try {
        const data = await apiGetIncidencias();
        tickets = data;
        renderNav();
        if (typeof generarNotificaciones === 'function') generarNotificaciones();
        if (currentView === 'gestion') renderGestion();
        if (currentView === 'mis') renderMis();
        if (currentView === 'analitica') renderAnalitica();
    } catch (err) {
        console.warn('No se pudieron cargar incidencias del backend:', err.message);
        if (typeof toast === 'function') {
            toast(`No se pudieron cargar las incidencias: ${err.message}`, 'warn');
        }
    }
}

// Datos agregados simulados para analítica (histórico)
const HORAS_EDIFICIO = [
    { e: 'Edificio C', h: 7.8 },
    { e: 'Edificio G', h: 6.9 },
    { e: 'Pesado 1', h: 6.1 },
    { e: 'Edificio J', h: 5.5 },
    { e: 'Vinculación', h: 4.8 },
    { e: 'Edificio F', h: 4.2 },
    { e: 'Rectoría', h: 3.6 },
    { e: 'Servicios Escolares', h: 3.1 },
    { e: 'Biblioteca', h: 2.2 },
];
const TOP_TAGS = [
    ['sin-red', 48], ['techo', 37], ['filtracion', 33], ['moodle', 29], ['switch', 25],
    ['proyector', 21], ['electrico', 18], ['aire-acondicionado', 15], ['wifi', 12], ['impresora', 9],
];
const SEMANAS = [[12, 6, 4], [15, 8, 3], [10, 9, 6], [18, 7, 5], [14, 11, 9], [20, 9, 4], [16, 13, 7], [22, 10, 6]];

const USUARIOS = [
    ['Laura Méndez', 'laura.mendez@utm.edu.mx', 'Reportante', true],
    ['Carlos Ruiz', 'carlos.ruiz@utm.edu.mx', 'Técnico', true],
    ['Ana Torres', 'ana.torres@utm.edu.mx', 'Técnico', true],
    ['Jorge Pech', 'jorge.pech@utm.edu.mx', 'Técnico', false],
    ['Mariana Chi', 'mariana.chi@utm.edu.mx', 'Coordinador', true],
    ['Dr. Raúl Baeza', 'raul.baeza@utm.edu.mx', 'Directivo', true],
    ['Daniel Flota', 'daniel.flota@utm.edu.mx', 'Administrador', true],
];

// ---------- Estado de la UI ----------
let role = 'Reportante';
let currentView = 'reporte';
let viewMode = 'kanban';
let uploaded = [];       // evidencias simuladas
let editing = null;      // ticket en el modal
let nextId = 1025;

// ---------- Utilidades ----------
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const initials = (n) => n.replace(/^(Dr\.|Ing\.)\s*/, '').split(' ').map((p) => p[0]).slice(0, 2).join('');
const prio = (v) => PRIORIDADES.find((p) => p.v === v) || PRIORIDADES[0];
const fakeOid = () => [...Array(24)].map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

function highlightJSON(obj) {
    return esc(JSON.stringify(obj, null, 2))
        .replace(/&quot;([^&]+?)&quot;:/g, '<span class="json-key">"$1"</span>:')
        .replace(/: &quot;(.*?)&quot;/g, ': <span class="json-str">"$1"</span>')
        .replace(/^(\s+)&quot;(.*?)&quot;(,?)$/gm, '$1<span class="json-str">"$2"</span>$3')
        .replace(/: (-?\d+\.?\d*)/g, ': <span class="json-num">$1</span>')
        .replace(/: (true|false|null)/g, ': <span class="json-bool">$1</span>');
}

function toast(msg, type = 'ok') {
    const icon = { ok: 'fa-circle-check text-green-600', warn: 'fa-triangle-exclamation text-amber-500', info: 'fa-circle-info text-sky-500' }[type];
    const el = document.createElement('div');
    el.className = 'toast flex items-start gap-3 bg-white border border-gray-200 shadow-xl rounded-2xl p-4';
    el.innerHTML = `<i class="fa-solid ${icon} mt-0.5"></i><p class="text-sm text-gray-700 flex-1">${msg}</p>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; }, 3200);
    setTimeout(() => el.remove(), 3600);
}

/** Detecta el rol según el correo ingresado y muestra/oculta el selector de rol global */
function loginUser(email) {
    const matchedRole = Object.keys(USERS).find((r) => USERS[r].email.toLowerCase() === email.toLowerCase()) || 'Reportante';
    const roleSelect = $('#roleSelect');
    const roleContainer = roleSelect ? roleSelect.closest('.relative').previousElementSibling : null; // Label "Rol (demo)"
    const roleWrapper = roleSelect ? roleSelect.closest('.relative') : null;

    setRole(matchedRole, true);

    // RESTRICCIÓN: Solo si es Administrador puede ver y usar el selector de roles para cambiar de rol
    const isAdmin = matchedRole === 'Administrador';
    if (roleSelect && roleWrapper) {
        roleWrapper.style.display = isAdmin ? 'block' : 'none';
        if (roleContainer && roleContainer.tagName === 'LABEL') {
            roleContainer.style.display = isAdmin ? 'block' : 'none';
        }
        roleSelect.value = matchedRole;
    }
}