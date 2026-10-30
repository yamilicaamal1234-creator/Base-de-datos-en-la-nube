/* =========================================================
   UTM Desk NoSQL Cloud — Sistema de Notificaciones
   Historial en tiempo real, alertas de incidencias y panel
   ========================================================= */

let notificaciones = [];

/** Obtiene los IDs de notificaciones leídas almacenados en localStorage */
function getReadNotificationIds() {
    try {
        return JSON.parse(localStorage.getItem('utm_read_notifications') || '[]');
    } catch {
        return [];
    }
}

/** Guarda los IDs de notificaciones leídas en localStorage */
function saveReadNotificationIds(ids) {
    localStorage.setItem('utm_read_notifications', JSON.stringify(ids));
}

/** Formatea una fecha o timestamp a tiempo relativo en español */
function timeAgo(dateInput) {
    if (!dateInput) return 'Reciente';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Reciente';
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Hace un momento';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Hace ${diffHr} h`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

/** Genera la lista de notificaciones activas según los tickets y el rol actual */
function generarNotificaciones() {
    const miNombre = currentUser ? (currentUser.nombre || `${currentUser.primer_nombre} ${currentUser.apellido_paterno}`) : (USERS[role]?.name || '');
    const notifs = [];

    // 1. Notificaciones basadas en el historial de tickets del sistema
    tickets.forEach((t) => {
        const esMio = (role === 'Técnico' && t.tecnico === miNombre) ||
                      (role === 'Reportante' && t.reportante === miNombre);
        const esGlobal = ['Coordinador', 'Administrador', 'Directivo'].includes(role);

        // Notificación para incidencias críticas abiertas
        if (t.prioridad === 'Crítica' && !['Resuelta', 'Cerrada'].includes(t.estado) && (esMio || esGlobal)) {
            notifs.push({
                id: `critica-${t.id}`,
                ticketId: t.id,
                tipo: 'critica',
                titulo: `Incidencia Crítica: ${t.id}`,
                mensaje: `${t.titulo} en ${t.edificio}`,
                fecha: t.fecha,
                icono: 'fa-triangle-exclamation',
                colorIcono: 'text-red-500 bg-red-100',
                estado: t.estado
            });
        }

        // Notificaciones por eventos en el historial de seguimiento
        if (Array.isArray(t.historial_seguimiento)) {
            t.historial_seguimiento.forEach((h, idx) => {
                if (!esMio && !esGlobal) return;

                const actorNombre = (h.actor && (h.actor.nombre || `${h.actor.primer_nombre || ''} ${h.actor.apellido_paterno || ''}`.trim())) || 'Sistema';
                let icon = 'fa-bell';
                let color = 'text-green-600 bg-green-100';
                let tituloNotif = `Actualización en ${t.id}`;

                if (h.tipo === 'cambio_estado') {
                    if (h.estado_nuevo === 'resuelta') {
                        icon = 'fa-circle-check';
                        color = 'text-emerald-600 bg-emerald-100';
                        tituloNotif = `Incidencia resuelta: ${t.id}`;
                    } else if (h.estado_nuevo === 'en proceso') {
                        icon = 'fa-gears';
                        color = 'text-amber-600 bg-amber-100';
                        tituloNotif = `En atención: ${t.id}`;
                    } else if (h.estado_nuevo === 'cerrada') {
                        icon = 'fa-lock';
                        color = 'text-gray-600 bg-gray-100';
                        tituloNotif = `Incidencia cerrada: ${t.id}`;
                    }
                } else if (h.tipo === 'creacion') {
                    icon = 'fa-circle-plus';
                    color = 'text-sky-600 bg-sky-100';
                    tituloNotif = `Nuevo reporte: ${t.id}`;
                }

                notifs.push({
                    id: `hist-${t.id}-${idx}`,
                    ticketId: t.id,
                    tipo: h.tipo || 'info',
                    titulo: tituloNotif,
                    mensaje: h.accion || `${actorNombre} actualizó el estado a ${h.estado_nuevo || t.estado}`,
                    fecha: h.fecha || t.fecha,
                    icono: icon,
                    colorIcono: color,
                    estado: t.estado
                });
            });
        }

        // Si es técnico y el ticket está asignado a él en estado "En proceso" o "Abierta"
        if (role === 'Técnico' && t.tecnico === miNombre && ['Abierta', 'En proceso'].includes(t.estado)) {
            notifs.push({
                id: `asig-${t.id}`,
                ticketId: t.id,
                tipo: 'asignacion',
                titulo: `Asignado a ti: ${t.id}`,
                mensaje: `${t.titulo} (${t.prioridad})`,
                fecha: t.fecha,
                icono: 'fa-user-gear',
                colorIcono: 'text-green-700 bg-green-100',
                estado: t.estado
            });
        }
    });

    // Ordenar de más reciente a más antiguo y limitar a las últimas 25
    notificaciones = notifs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 25);
    renderNotificaciones();
}

/** Renderiza el panel dropdown y actualiza la insignia de notificaciones */
function renderNotificaciones() {
    const listEl = $('#notifList');
    const badgeEl = $('#notifBadge');
    const countHeaderEl = $('#notifCountHeader');
    if (!listEl) return;

    const readIds = new Set(getReadNotificationIds());
    const noLeidas = notificaciones.filter((n) => !readIds.has(n.id));

    // Actualizar insignia en el botón de campana
    if (badgeEl) {
        if (noLeidas.length > 0) {
            badgeEl.textContent = noLeidas.length > 9 ? '9+' : noLeidas.length;
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }
    }

    if (countHeaderEl) {
        countHeaderEl.textContent = noLeidas.length === 1 ? '1 nueva' : `${noLeidas.length} nuevas`;
    }

    if (notificaciones.length === 0) {
        listEl.innerHTML = `
            <div class="py-10 px-4 text-center">
                <div class="w-12 h-12 mx-auto rounded-full bg-gray-100 grid place-items-center text-gray-400 mb-2">
                    <i class="fa-regular fa-bell-slash text-lg"></i>
                </div>
                <p class="text-sm font-semibold text-gray-700">Sin notificaciones</p>
                <p class="text-xs text-gray-400 mt-0.5">Te avisaremos cuando haya actividad en tus tickets.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = notificaciones.map((n) => {
        const esLeida = readIds.has(n.id);
        return `
        <div data-notif-id="${n.id}" data-ticket-id="${n.ticketId}" class="notif-item p-3.5 hover:bg-green-50/60 transition cursor-pointer flex items-start gap-3 relative ${esLeida ? 'opacity-70 bg-white' : 'bg-green-50/20'}">
            <div class="w-9 h-9 rounded-xl grid place-items-center shrink-0 ${n.colorIcono}">
                <i class="fa-solid ${n.icono} text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                    <p class="text-xs font-bold text-gray-900 truncate">${esc(n.titulo)}</p>
                    <span class="text-[10px] text-gray-400 shrink-0">${timeAgo(n.fecha)}</span>
                </div>
                <p class="text-xs text-gray-600 line-clamp-2 mt-0.5">${esc(n.mensaje)}</p>
            </div>
            ${!esLeida ? '<span class="w-2 h-2 rounded-full bg-green-600 shrink-0 mt-1.5" title="No leída"></span>' : ''}
        </div>
        `;
    }).join('');
}

/** Agrega una notificación dinámica en tiempo real y muestra un toast */
function registrarNotificacionLocal(item) {
    const id = item.id || `notif-${Date.now()}`;
    const nueva = {
        id,
        ticketId: item.ticketId || '',
        tipo: item.tipo || 'info',
        titulo: item.titulo || 'Notificación del sistema',
        mensaje: item.mensaje || '',
        fecha: new Date().toISOString(),
        icono: item.icono || 'fa-bell',
        colorIcono: item.colorIcono || 'text-green-700 bg-green-100',
        estado: item.estado || ''
    };
    notificaciones.unshift(nueva);
    renderNotificaciones();
}

/** Inicialización de eventos del módulo de notificaciones */
document.addEventListener('DOMContentLoaded', () => {
    const btnNotif = $('#btnNotif');
    const dropdown = $('#notifDropdown');
    const btnMarkAll = $('#btnMarkAllRead');

    if (btnNotif && dropdown) {
        btnNotif.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        // Cerrar al hacer clic fuera del dropdown
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btnNotif.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    if (btnMarkAll) {
        btnMarkAll.addEventListener('click', (e) => {
            e.stopPropagation();
            const allIds = notificaciones.map((n) => n.id);
            saveReadNotificationIds(allIds);
            renderNotificaciones();
            toast('Todas las notificaciones han sido marcadas como leídas.', 'ok');
        });
    }

    // Clic en una notificación individual: marcar como leída y navegar a la incidencia
    if ($('#notifList')) {
        $('#notifList').addEventListener('click', (e) => {
            const item = e.target.closest('[data-notif-id]');
            if (!item) return;

            const notifId = item.dataset.notifId;
            const ticketId = item.dataset.ticketId;

            // Marcar como leída
            const readIds = new Set(getReadNotificationIds());
            readIds.add(notifId);
            saveReadNotificationIds([...readIds]);
            renderNotificaciones();

            // Cerrar dropdown
            if (dropdown) dropdown.classList.add('hidden');

            // Navegar según rol
            if (ticketId) {
                if (['Técnico', 'Coordinador', 'Administrador'].includes(role)) {
                    showView('gestion');
                    // Si la función openModal existe, podemos abrir el modal de la incidencia
                    if (typeof openModal === 'function') {
                        setTimeout(() => openModal(ticketId), 250);
                    }
                } else if (role === 'Reportante') {
                    showView('mis');
                }
            }
        });
    }
});
