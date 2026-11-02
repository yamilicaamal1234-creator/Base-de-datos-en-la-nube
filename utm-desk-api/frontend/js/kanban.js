/* =========================================================
   RF-03 · Gestión Kanban, Tabla y Actualización Atómica (API)
   ========================================================= */

function filteredTickets() {
    const q = $('#search') ? $('#search').value.toLowerCase().trim() : '';
    const c = $('#filterCat') ? $('#filterCat').value : '';
    const mine = $('#onlyMine') && $('#onlyMine').checked && role === 'Técnico';
    const miNombre = currentUser ? currentUser.nombre : USERS[role]?.name;

    return tickets.filter((t) =>
        (!c || t.categoria === c) &&
        (!mine || t.tecnico === miNombre) &&
        (!q || [t.id, t.titulo, ...(t.tags || [])].join(' ').toLowerCase().includes(q)));
}

const tagChips = (tags) => (tags || []).map((g) => `<span class="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-green-50 text-green-800 ring-1 ring-green-200">#${esc(g)}</span>`).join('');

function cardHTML(t) {
    const p = prio(t.prioridad);
    const evidenciaBadge = t.evidencias && t.evidencias.length
        ? `<a href="${t.evidencias[0].url_storage || '#'}" target="_blank" onclick="event.stopPropagation()" class="text-[11px] text-green-700 hover:text-green-900 font-semibold flex items-center gap-1" title="Ver ${t.evidencias.length} archivo(s) en Cloudinary"><i class="fa-solid fa-cloud-arrow-up"></i> ${t.evidencias.length > 1 ? `Evidencias (${t.evidencias.length})` : 'Evidencia'}</a>`
        : '';

    return `
  <article draggable="true" data-id="${t.id}" class="k-card relative bg-white rounded-xl border border-gray-200 p-4 pl-5 cursor-pointer hover:shadow-md hover:border-green-300 transition overflow-hidden">
    <span class="absolute left-0 top-0 bottom-0 w-1.5 ${p.stripe}"></span>
    <div class="flex items-center gap-2 text-[11px]">
      <span class="font-mono text-gray-400">${t.id}</span>
      <span class="px-1.5 py-0.5 rounded font-bold ${p.chip}">${t.prioridad}</span>
      <i class="fa-solid ${CAT_ICON[t.categoria] || 'fa-tag'} ml-auto text-gray-400" title="${CAT_LABEL[t.categoria] || t.categoria}"></i>
    </div>
    <h4 class="mt-2 font-semibold text-sm text-gray-900 leading-snug">${esc(t.titulo)}</h4>
    <p class="mt-1 text-[11px] text-gray-500"><i class="fa-solid fa-location-dot mr-1"></i>${esc(t.edificio)}</p>
    <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
      ${tagChips(t.tags)}
      ${evidenciaBadge}
    </div>
    <div class="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
      <span class="w-7 h-7 rounded-full bg-green-700 text-white text-[10px] font-bold grid place-items-center" title="${t.tecnico}">${initials(t.tecnico)}</span>
      <span class="text-[11px] text-gray-600 font-medium truncate max-w-[130px]" title="${t.tecnico}">${t.tecnico}</span>
      <span class="ml-auto text-[11px] text-gray-500 font-medium whitespace-nowrap"><i class="fa-regular fa-clock mr-1"></i>${t.horas} h</span>
    </div>
  </article>`;
}

function renderGestion() {
    const list = filteredTickets();
    $('#kanban').innerHTML = ESTADOS.map((s) => {
        const items = list.filter((t) => t.estado === s);
        return `
    <div class="k-col bg-gray-100/80 rounded-2xl p-3 flex flex-col min-h-[420px] transition" data-estado="${s}">
      <div class="flex items-center gap-2 px-2 py-2 mb-2">
        <span class="w-2.5 h-2.5 rounded-full ${ESTADO_STYLE[s].dot}"></span>
        <h3 class="font-bold text-sm text-gray-800">${s}</h3>
        <span class="ml-auto text-xs font-bold text-gray-500 bg-white rounded-full px-2 py-0.5">${items.length}</span>
      </div>
      <div class="space-y-3 flex-1">${items.map(cardHTML).join('') || '<p class="text-center text-xs text-gray-400 py-8 border-2 border-dashed border-gray-200 rounded-xl">Sin tickets</p>'}</div>
    </div>`;
    }).join('');

    $('#tablaBody').innerHTML = list.map((t) => `
    <tr class="hover:bg-green-50/50 cursor-pointer transition" data-view-detail="${t.id}">
      <td class="px-5 py-3 font-mono text-xs text-gray-500">${t.id}</td>
      <td class="px-5 py-3"><p class="font-semibold text-gray-900">${esc(t.titulo)}</p><div class="mt-1 flex flex-wrap gap-1">${tagChips(t.tags)}</div></td>
      <td class="px-5 py-3 text-gray-600 whitespace-nowrap"><i class="fa-solid ${CAT_ICON[t.categoria] || 'fa-tag'} mr-1.5 text-gray-400"></i>${CAT_LABEL[t.categoria] || t.categoria}</td>
      <td class="px-5 py-3"><span class="text-xs px-2 py-0.5 rounded font-bold ${prio(t.prioridad).chip}">${t.prioridad}</span></td>
      <td class="px-5 py-3"><span class="text-xs px-2.5 py-1 rounded-full ring-1 font-semibold whitespace-nowrap ${ESTADO_STYLE[t.estado]?.chip || ''}">${t.estado}</span></td>
      <td class="px-5 py-3 text-gray-700 whitespace-nowrap">${t.tecnico}</td>
      <td class="px-5 py-3 text-right font-semibold">${t.horas} h</td>
      <td class="px-5 py-3 text-right text-gray-400 text-xs"><i class="fa-solid fa-chevron-right"></i></td>
    </tr>`).join('') || '<tr><td colspan="8" class="p-8 text-center text-gray-400">Sin incidencias registradas</td></tr>';
}

['input', 'change'].forEach((ev) => {
    if ($('#search')) $('#search').addEventListener(ev, renderGestion);
    if ($('#filterCat')) $('#filterCat').addEventListener(ev, renderGestion);
});
if ($('#onlyMine')) $('#onlyMine').addEventListener('change', renderGestion);

$$('.mode-btn').forEach((b) => b.addEventListener('click', () => {
    viewMode = b.dataset.mode;
    $$('.mode-btn').forEach((x) => {
        const on = x === b;
        x.classList.toggle('bg-white', on); x.classList.toggle('shadow', on);
        x.classList.toggle('text-green-800', on); x.classList.toggle('text-gray-500', !on);
    });
    $('#kanban').classList.toggle('hidden', viewMode !== 'kanban');
    $('#tabla').classList.toggle('hidden', viewMode !== 'tabla');
}));

// Drag & drop entre columnas
let dragId = null;
let isDraggingCard = false;
$('#kanban').addEventListener('dragstart', (e) => {
    const c = e.target.closest('.k-card'); if (!c) return;
    isDraggingCard = true;
    dragId = c.dataset.id; c.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
});
$('#kanban').addEventListener('dragend', (e) => { 
    e.target.closest('.k-card')?.classList.remove('dragging'); 
    setTimeout(() => { isDraggingCard = false; }, 150);
});
$('#kanban').addEventListener('dragover', (e) => {
    const col = e.target.closest('.k-col'); if (!col) return;
    e.preventDefault();
    $$('.k-col').forEach((c) => c.classList.toggle('drag-over', c === col));
});
$('#kanban').addEventListener('dragleave', (e) => { if (!e.currentTarget.contains(e.relatedTarget)) $$('.k-col').forEach((c) => c.classList.remove('drag-over')); });
$('#kanban').addEventListener('drop', (e) => {
    e.preventDefault();
    const col = e.target.closest('.k-col');
    $$('.k-col').forEach((c) => c.classList.remove('drag-over'));
    if (col && dragId) {
        const t = tickets.find((x) => x.id === dragId);
        if (t && t.estado !== col.dataset.estado) openModal(dragId, col.dataset.estado);
    }
    dragId = null;
});

// Listener global de interacción para cartas y botones
document.addEventListener('click', (e) => {
    // 1. Clic en botón "Actualizar"
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
        openModal(editBtn.dataset.edit);
        return;
    }

    // 2. Si se hizo clic en un enlace de evidencia externa o botón de cerrar, no abrir detalle
    if (e.target.closest('a') || e.target.closest('[data-close]')) return;

    // 3. Si se estaba arrastrando la tarjeta, no abrir modal
    if (isDraggingCard) return;

    // 4. Clic en tarjeta de Kanban, fila de tabla o reporte
    const card = e.target.closest('.k-card[data-id], tr[data-view-detail], #misList > div[data-id]');
    if (card) {
        const ticketId = card.dataset.id || card.dataset.viewDetail;
        if (ticketId) openDetailModal(ticketId);
    }
});

// ---------- Modal de Detalle Completo de Incidencia ----------
const detailModal = $('#modalTicketDetail');
let currentDetailTicket = null;

function closeDetailModal() {
    const detailPanel = $('#modalTicketDetail .panel');
    if (detailPanel && detailPanel._resetPosition) detailPanel._resetPosition();
    if (detailModal) detailModal.classList.remove('show');
    currentDetailTicket = null;
}

function openDetailModal(id) {
    const detailPanel = $('#modalTicketDetail .panel');
    if (detailPanel && detailPanel._resetPosition) detailPanel._resetPosition();
    const t = tickets.find((x) => x.id === id);
    if (!t || !detailModal) return;
    currentDetailTicket = t;

    // Encabezado
    const p = prio(t.prioridad);
    $('#dtFolio').textContent = t.id;
    $('#dtTitulo').textContent = t.titulo;
    $('#dtCatChip').textContent = CAT_LABEL[t.categoria] || t.categoria;
    $('#dtCatIcon').innerHTML = `<i class="fa-solid ${CAT_ICON[t.categoria] || 'fa-tag'}"></i>`;

    // Prioridad
    const prioEl = $('#dtPrioridad');
    prioEl.textContent = t.prioridad;
    prioEl.className = `text-xs px-2.5 py-0.5 rounded-md font-bold ${p.chip}`;

    // Estado
    const estEl = $('#dtEstado');
    estEl.textContent = t.estado;
    estEl.className = `text-xs px-2.5 py-0.5 rounded-full font-bold ring-1 ${ESTADO_STYLE[t.estado]?.chip || 'bg-gray-100 text-gray-700'}`;

    // Reportante
    const repNombre = t.reportante || 'Usuario';
    $('#dtReportante').textContent = repNombre;
    $('#dtRepAvatar').textContent = initials(repNombre);
    const emailEl = $('#dtReportanteEmail');
    const repCorreo = t.reportante_correo || (t.reportante_obj?.correo || '');
    emailEl.textContent = repCorreo || (t.reportante_perfil ? `Perfil: ${t.reportante_perfil}` : 'Usuario institucional');
    emailEl.title = repCorreo;

    // Ubicación
    $('#dtEdificio').textContent = t.edificio || 'Campus UTM';
    $('#dtZona').textContent = t.zona ? `Zona: ${t.zona}` : (t.categoria === 'academico' ? 'Campus Virtual / En línea' : 'Área General');

    // Fecha de registro
    let fechaStr = t.fecha || 'Sin fecha';
    if (t.fecha_completa || t.fecha) {
        try {
            const rawFecha = t.fecha_completa || t.fecha;
            const parsed = new Date(rawFecha.$date || rawFecha);
            if (!isNaN(parsed.getTime())) {
                fechaStr = parsed.toLocaleDateString('es-MX', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (e) {}
    }
    $('#dtFecha').textContent = fechaStr;

    // Técnico y Horas
    $('#dtTecnico').textContent = t.tecnico || 'Sin asignar';
    $('#dtTecAvatar').textContent = initials(t.tecnico || 'SA');
    $('#dtHoras').innerHTML = `<i class="fa-regular fa-clock mr-1"></i>${t.horas} h acumuladas`;

    // Descripción del problema
    $('#dtDescripcion').textContent = t.descripcion || 'Sin descripción detallada proporcionada al crear el reporte.';

    // Detalles técnicos polimórficos por categoría
    const det = t.detalle_especifico || {};
    const detTituloEl = $('#dtDetallesTitulo');
    const detContenidoEl = $('#dtDetallesContenido');

    detTituloEl.textContent = `Detalles Técnicos · ${CAT_LABEL[t.categoria] || t.categoria}`;

    let detHTML = '';
    if (t.categoria === 'redes') {
        detHTML = `
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Tipo de Equipo</span>
                <span class="font-bold text-gray-800 text-sm">${esc(det.tipo_equipo || 'PC de escritorio')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Dirección IP</span>
                <span class="font-mono font-semibold text-gray-800">${esc(det.direccion_ip || 'No asignada / DHCP')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">VLAN</span>
                <span class="font-mono font-semibold text-gray-800">${esc(det.vlan || 'Sin VLAN específica')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Puerto de Red / Conexión</span>
                <span class="font-mono font-semibold text-gray-800">${esc(det.puerto_conexion || det.puerto || 'No registrado')}</span>
            </div>
        `;
    } else if (t.categoria === 'infra') {
        const riesgoNivel = (det.nivel_riesgo || 'medio').toLowerCase();
        const badgeColor = {
            bajo: 'bg-green-100 text-green-800',
            medio: 'bg-amber-100 text-amber-800',
            alto: 'bg-orange-100 text-orange-800',
            critico: 'bg-red-100 text-red-800'
        }[riesgoNivel] || 'bg-gray-100 text-gray-800';

        let insumosArr = [];
        if (Array.isArray(det.insumos_requeridos)) insumosArr = det.insumos_requeridos;
        else if (Array.isArray(det.insumos)) insumosArr = det.insumos;
        else if (typeof det.insumos_requeridos === 'string') insumosArr = [det.insumos_requeridos];
        else if (typeof det.insumos === 'string') insumosArr = [det.insumos];

        const insumosHTML = insumosArr.length
            ? `<div class="flex flex-wrap gap-1 mt-1">${insumosArr.map(ins => `<span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[11px]">${esc(ins)}</span>`).join('')}</div>`
            : '<span class="text-gray-500 font-normal">Ninguno especificado</span>';

        detHTML = `
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Tipo de Daño</span>
                <span class="font-bold text-gray-800 text-sm">${esc(det.tipo_dano || det.tipo_danio || 'Estructural')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Nivel de Riesgo</span>
                <span class="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${badgeColor}">${esc(det.nivel_riesgo || 'Medio')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm sm:col-span-2">
                <span class="text-gray-400 block font-medium">Descripción del Riesgo</span>
                <span class="text-gray-800 text-xs">${esc(det.riesgo_descripcion || det.descripcion_riesgo || 'Sin observaciones de riesgo')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Insumos Requeridos</span>
                ${insumosHTML}
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Contratista Externo</span>
                <span class="font-semibold text-xs ${det.requiere_contratista_externo ? 'text-amber-700' : 'text-gray-700'}">
                    ${det.requiere_contratista_externo ? '<i class="fa-solid fa-triangle-exclamation mr-1"></i> Requiere contratista externo' : '<i class="fa-solid fa-check mr-1 text-green-600"></i> Resuelto por personal interno'}
                </span>
            </div>
        `;
    } else if (t.categoria === 'academico') {
        detHTML = `
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Plataforma Afectada</span>
                <span class="font-bold text-gray-800 text-sm">${esc(det.plataforma || 'Moodle')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <span class="text-gray-400 block font-medium">Periodo Escolar</span>
                <span class="font-semibold text-gray-800">${esc(det.periodo_escolar || det.periodo || 'Vigente')}</span>
            </div>
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm sm:col-span-2">
                <span class="text-gray-400 block font-medium">Estudiantes Afectados</span>
                <span class="font-bold text-gray-900 text-sm">${det.estudiantes_afectados != null ? det.estudiantes_afectados : 'No especificado'} alumnos</span>
            </div>
        `;
    } else {
        detHTML = `<p class="text-gray-400 italic">No se indicaron especificaciones adicionales para esta categoría.</p>`;
    }
    detContenidoEl.innerHTML = detHTML;

    // Tags
    $('#dtTags').innerHTML = tagChips(t.tags) || '<span class="text-xs text-gray-400 italic">Sin etiquetas asignadas</span>';

    // Evidencias (Cloudinary)
    const evContainer = $('#dtEvidenciasContainer');
    if (t.evidencias && t.evidencias.length > 0) {
        evContainer.innerHTML = t.evidencias.map((ev) => {
            const url = ev.url_storage || ev.url || '#';
            const name = ev.nombre_archivo || ev.nombre || 'Archivo de evidencia';
            const size = ev.tamano_bytes 
                ? `${(ev.tamano_bytes / 1024).toFixed(1)} KB` 
                : (ev.tamano_kb ? `${ev.tamano_kb} KB` : '');

            const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || (ev.formato && ['jpg', 'jpeg', 'png', 'webp'].includes(ev.formato.toLowerCase())) || ev.tipo === 'image';

            return `
                <div class="p-3 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        ${isImage ? `
                            <a href="${url}" target="_blank" class="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 shrink-0 border border-gray-300 relative group block" title="Clic para ver en tamaño completo">
                                <img src="${url}" alt="${esc(name)}" class="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                                <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 grid place-items-center text-white text-xs transition">
                                    <i class="fa-solid fa-magnifying-glass-plus"></i>
                                </div>
                            </a>
                        ` : `
                            <div class="w-12 h-12 rounded-xl bg-green-100 text-green-700 grid place-items-center text-lg shrink-0">
                                <i class="fa-solid fa-file-arrow-up"></i>
                            </div>
                        `}
                        <div class="min-w-0">
                            <p class="font-bold text-xs text-gray-900 truncate" title="${esc(name)}">${esc(name)}</p>
                            <p class="text-[11px] text-gray-500 mt-0.5">
                                ${size ? `<span class="mr-2 font-mono">${size}</span>` : ''}
                                <span class="text-green-700 font-semibold"><i class="fa-solid fa-cloud mr-1"></i>En Cloudinary</span>
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                        <a href="${url}" target="_blank" class="px-3.5 py-1.5 rounded-xl bg-white border border-gray-300 hover:border-green-600 hover:text-green-700 font-semibold text-xs text-gray-700 shadow-sm transition flex items-center gap-1.5">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver archivo
                        </a>
                        <button type="button" data-del-detalle-ev="${url}" data-ticket-id="${t.id}" class="p-2 rounded-xl border border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-300 transition" title="Eliminar evidencia">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        evContainer.innerHTML = `
            <div class="p-3.5 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center text-gray-400 text-xs">
                <i class="fa-regular fa-image mr-1 text-sm align-middle"></i> No se adjuntaron fotografías o evidencias con esta incidencia.
            </div>
        `;
    }

    // Historial de seguimiento
    const histContainer = $('#dtHistorialContainer');
    if (t.historial_seguimiento && t.historial_seguimiento.length > 0) {
        histContainer.innerHTML = t.historial_seguimiento.map((h) => {
            let fechaHist = '';
            try {
                const fh = h.fecha?.$date || h.fecha;
                if (fh) {
                    const parsed = new Date(fh);
                    if (!isNaN(parsed.getTime())) {
                        fechaHist = parsed.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    }
                }
            } catch(e) {}

            const actorNombre = h.actor?.nombre || `${h.actor?.primer_nombre || ''} ${h.actor?.apellido_paterno || ''}`.trim() || 'Sistema';
            const actorRol = h.actor?.rol ? `(${h.actor.rol})` : '';

            return `
                <div class="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div class="w-2 h-2 rounded-full bg-green-600 mt-1.5 shrink-0"></div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <span class="font-semibold text-gray-800 text-xs">${esc(actorNombre)} <span class="text-gray-400 font-normal">${esc(actorRol)}</span></span>
                            <span class="text-[10px] text-gray-400 shrink-0 font-mono">${fechaHist}</span>
                        </div>
                        <p class="text-gray-600 mt-0.5 text-xs">${esc(h.accion || h.nota || 'Actualización registrada')}</p>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        histContainer.innerHTML = `<p class="text-xs text-gray-400 italic">Sin historial de cambios registrado.</p>`;
    }

    // Botón Actualizar esta incidencia
    const btnAct = $('#dtBtnActualizar');
    const canUpdate = ['Técnico', 'Coordinador', 'Administrador'].includes(role);
    if (btnAct) {
        btnAct.style.display = canUpdate ? 'flex' : 'none';
        btnAct.onclick = () => {
            closeDetailModal();
            openModal(t.id);
        };
    }

    detailModal.classList.add('show');
}

if (detailModal) {
    $$('[data-close]', detailModal).forEach((b) => b.addEventListener('click', closeDetailModal));
    detailModal.addEventListener('click', (e) => { if (detailModal._didDrag) return; if (e.target === detailModal) closeDetailModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && detailModal.classList.contains('show')) closeDetailModal(); });
}

// ---------- Modal de actualización atómica (RF-03) ----------
const modal = $('#modalUpdate');
const evidenciasParaEliminar = new Set();

function renderEvidenciasUpdate() {
    const sec = $('#mEvidenciasSection');
    const list = $('#mEvidenciasList');
    const countEl = $('#mEvidenciasCount');
    if (!sec || !list || !editing) return;

    const evs = editing.evidencias || [];
    if (evs.length === 0) {
        sec.classList.add('hidden');
        return;
    }

    sec.classList.remove('hidden');
    const activas = evs.length - evidenciasParaEliminar.size;
    if (countEl) countEl.textContent = `(${activas} de ${evs.length})`;

    list.innerHTML = evs.map((ev) => {
        const url = ev.url_storage || ev.url || '#';
        const name = ev.nombre_archivo || ev.nombre || 'Evidencia';
        const isMarked = evidenciasParaEliminar.has(url);
        const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url) || (ev.formato && ['jpg', 'jpeg', 'png', 'webp'].includes(ev.formato.toLowerCase())) || ev.tipo === 'image';
        const size = ev.tamano_bytes 
            ? `${(ev.tamano_bytes / 1024).toFixed(1)} KB` 
            : (ev.peso_kb ? `${ev.peso_kb} KB` : '');

        return `
        <div class="p-2 rounded-xl border flex items-center justify-between gap-2.5 transition text-xs ${isMarked ? 'bg-red-50/80 border-red-300' : 'bg-gray-50 border-gray-200'}">
            <div class="flex items-center gap-2.5 min-w-0">
                ${isImage ? `
                    <a href="${url}" target="_blank" class="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-gray-300 relative block group">
                        <img src="${url}" alt="${esc(name)}" class="w-full h-full object-cover group-hover:scale-105 transition" />
                    </a>
                ` : `
                    <span class="w-8 h-8 rounded-lg bg-green-100 text-green-700 grid place-items-center text-xs shrink-0">
                        <i class="fa-solid fa-file-arrow-up"></i>
                    </span>
                `}
                <div class="min-w-0">
                    <p class="font-semibold text-gray-800 truncate ${isMarked ? 'line-through text-red-700' : ''}" title="${esc(name)}">${esc(name)}</p>
                    ${isMarked ? `
                        <span class="text-[10px] text-red-600 font-bold inline-flex items-center gap-1">
                            <i class="fa-solid fa-trash-can text-[9px]"></i> Se eliminará al guardar
                        </span>
                    ` : `
                        <span class="text-[10px] text-gray-400 font-mono">${size || 'Cloudinary'}</span>
                    `}
                </div>
            </div>
            <button type="button" data-toggle-del-ev="${url}" class="px-2 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${isMarked ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100' : 'text-red-500 hover:text-red-700 hover:bg-red-100/60'}" title="${isMarked ? 'Cancelar eliminación' : 'Eliminar imagen'}">
                ${isMarked ? '<i class="fa-solid fa-rotate-left mr-1"></i>Deshacer' : '<i class="fa-solid fa-trash-can mr-1"></i>Quitar'}
            </button>
        </div>`;
    }).join('');
}

function openModal(id, presetEstado) {
    editing = tickets.find((t) => t.id === id);
    if (!editing) return;

    evidenciasParaEliminar.clear();

    // Resetear posición centrada del panel
    const formUpdateEl = $('#formUpdate');
    if (formUpdateEl) {
        if (formUpdateEl._resetPosition) formUpdateEl._resetPosition();
        formUpdateEl.style.transform = '';
        formUpdateEl.style.transition = '';
    }

    $('#mTitle').textContent = `${editing.id} · ${editing.titulo}`;
    $('#mEstado').innerHTML = ESTADOS.map((s) => `<option ${s === (presetEstado || editing.estado) ? 'selected' : ''}>${s}</option>`).join('');
    $('#mTecnico').innerHTML = TECNICOS.map((t) =>
        `<option value="${esc(t.auth_uid)}" ${t.nombre === editing.tecnico ? 'selected' : ''}>${esc(t.nombre)}</option>`
    ).join('');
    if (!TECNICOS.length) {
        $('#mTecnico').innerHTML = `<option value="">Sin técnicos disponibles</option>`;
    }
    const canAssign = ['Coordinador', 'Administrador'].includes(role);
    $('#mTecnico').disabled = !canAssign;
    $('#mTecLock').innerHTML = canAssign ? '' : '<i class="fa-solid fa-lock ml-1"></i> solo Coordinador';
    
    const horasInput = $('#mHoras');
    if (horasInput) {
        horasInput.value = 0;
        horasInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
    }
    const errEl = $('#mHorasError');
    if (errEl) errEl.classList.add('hidden');
    $('#mNota').value = '';

    const horasActuales = Number(editing.horas || 0);
    if ($('#mHorasActual')) $('#mHorasActual').textContent = `${horasActuales} h`;
    if ($('#mHorasTotalPreview')) $('#mHorasTotalPreview').textContent = `Total: ${horasActuales} h`;

    renderEvidenciasUpdate();
    renderOp();
    modal.classList.add('show');
    setTimeout(() => $('#mHoras')?.focus(), 150);
}

const closeModal = () => { 
    modal.classList.remove('show'); 
    editing = null;
    evidenciasParaEliminar.clear();
    const formUpdateEl = $('#formUpdate');
    if (formUpdateEl) {
        if (formUpdateEl._resetPosition) formUpdateEl._resetPosition();
        formUpdateEl.style.transform = '';
        formUpdateEl.style.transition = '';
    }
    const errEl = $('#mHorasError');
    if (errEl) errEl.classList.add('hidden');
    $('#mHoras')?.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
};

function validarHorasInput() {
    const horasInput = $('#mHoras');
    const errEl = $('#mHorasError');
    if (!horasInput) return true;

    const raw = String(horasInput.value ?? '').trim();

    const showError = (msg) => {
        if (errEl) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
        }
        horasInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
        return false;
    };

    const clearError = () => {
        if (errEl) errEl.classList.add('hidden');
        horasInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
        return true;
    };

    if (raw === '') {
        return showError('Ingresa una cantidad de horas (ej. 1 o 2.5).');
    }

    const val = Number(raw);

    if (isNaN(val)) {
        return showError('El valor de horas no es un número válido.');
    }

    if (val < 0) {
        return showError('Las horas no pueden ser negativas.');
    }

    if (val > 24) {
        return showError(`Máximo 24 h por actualización (ingresaste ${val} h).`);
    }

    return clearError();
}

function renderOp() {
    if (!editing) return;
    const nuevoEstado = $('#mEstado').value;
    const horasInput = $('#mHoras');
    const esValido = validarHorasInput();
    const horasVal = Number(horasInput?.value);
    const horasASumar = (esValido && !isNaN(horasVal) && horasVal >= 0 && horasVal <= 24) ? horasVal : 0;
    
    // Actualizar cálculo de acumulación en vivo
    const actual = Number(editing.horas || 0);
    const totalFuturo = Math.round((actual + horasASumar) * 10) / 10;
    if ($('#mHorasActual')) $('#mHorasActual').textContent = `${actual} h`;
    if ($('#mHorasTotalPreview')) $('#mHorasTotalPreview').textContent = `Total: ${totalFuturo} h`;

    const nombreActor = currentUser ? currentUser.nombre : USERS[role]?.name || 'Técnico';
    const tecnicoSeleccionado = TECNICOS.find((t) => t.auth_uid === $('#mTecnico').value) || null;

    const set = { estado: nuevoEstado.toLowerCase() };
    if (tecnicoSeleccionado && tecnicoSeleccionado.nombre !== editing.tecnico) {
        set['tecnico_asignado.auth_uid'] = tecnicoSeleccionado.auth_uid;
        set['tecnico_asignado.primer_nombre'] = tecnicoSeleccionado.primer_nombre;
        set['tecnico_asignado.apellido_paterno'] = tecnicoSeleccionado.apellido_paterno;
        set['tecnico_asignado.rol'] = 'tecnico';
    }
    if (['Resuelta', 'Cerrada'].includes(nuevoEstado)) {
        set.fecha_resolucion = '$$NOW';
    }

    const upd = {
        $set: set,
        $push: {
            historial_seguimiento: {
                tipo: 'cambio_estado',
                estado_previo: editing.estado.toLowerCase(),
                estado_nuevo: nuevoEstado.toLowerCase(),
                actor: { nombre: nombreActor, rol: role.toLowerCase() },
                accion: $('#mNota').value || `Estado actualizado a ${nuevoEstado}`,
                fecha: '$$NOW'
            }
        }
    };

    if (horasASumar > 0) {
        upd.$inc = { horas_invertidas_totales: horasASumar };
    }

    if (evidenciasParaEliminar.size > 0) {
        upd.$pull = {
            evidencias_adjuntas: {
                url_storage: { $in: Array.from(evidenciasParaEliminar) }
            }
        };
    }

    $('#mOp').innerHTML = `<span class="text-gray-400">db.incidencias_campus.</span><span class="text-green-300">updateOne</span>(\n` +
        `  ${highlightJSON({ codigo: editing.id })},\n  ${highlightJSON(upd).replace(/\n/g, '\n  ')}\n)`;
}

['input', 'change'].forEach((ev) => modal.addEventListener(ev, renderOp));
$$('[data-close]', modal).forEach((b) => b.addEventListener('click', closeModal));
modal.addEventListener('click', (e) => { 
    if (modal._didDrag) return;
    if (e.target === modal) closeModal(); 
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('show')) closeModal(); });

const horasInputEl = $('#mHoras');
if (horasInputEl) {
    horasInputEl.addEventListener('input', () => {
        validarHorasInput();
        renderOp();
    });
    horasInputEl.addEventListener('change', () => {
        validarHorasInput();
        renderOp();
    });
}

// Delegación de eventos para eliminar / deshacer eliminación de evidencias en el modal de actualización
$('#mEvidenciasList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-del-ev]');
    if (!btn) return;
    const url = btn.dataset.toggleDelEv;
    if (evidenciasParaEliminar.has(url)) {
        evidenciasParaEliminar.delete(url);
    } else {
        evidenciasParaEliminar.add(url);
    }
    renderEvidenciasUpdate();
    renderOp();
});

// Delegación de eventos para eliminar evidencia directamente desde el modal de detalle
$('#dtEvidenciasContainer')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-detalle-ev]');
    if (!btn) return;
    const url = btn.dataset.delDetalleEv;
    const ticketId = btn.dataset.ticketId;
    if (!url || !ticketId) return;

    if (!confirm('¿Deseas eliminar permanentemente esta imagen de evidencia de la incidencia y Cloudinary?')) {
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';

    try {
        await apiEliminarEvidencia(ticketId, url);
        toast('Evidencia eliminada correctamente de MongoDB y Cloudinary.', 'ok');
        
        // Actualizar ticket en memoria local
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket && Array.isArray(ticket.evidencias)) {
            ticket.evidencias = ticket.evidencias.filter(ev => (ev.url_storage || ev.url) !== url);
            openDetailModal(ticket); // Re-renderizar detalle
        }
        renderGestion();
        await cargarIncidenciasDesdeAPI();
    } catch (err) {
        console.error('Error al eliminar evidencia:', err);
        if (err.message && err.message.includes('404')) {
            toast('<b>Error 404:</b> El servidor en Render aún no tiene este endpoint desplegado. Inicia tu servidor local con <code>npm start</code> en la carpeta <code>utm-desk-api</code>.', 'warn');
        } else {
            toast(`Error al eliminar evidencia: ${err.message}`, 'warn');
        }
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash-can text-xs"></i>';
    }
});

// ---------- Función para hacer modales arrastrables con cursor suave y límites precisos ----------
function makeModalDraggable(modalEl, headerEl, panelEl) {
    if (!modalEl || !headerEl || !panelEl) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let minX = -1000;
    let maxX = 1000;
    let minY = -1000;
    let maxY = 1000;

    panelEl._resetPosition = () => {
        currentX = 0;
        currentY = 0;
        panelEl.style.transform = '';
        panelEl.style.transition = '';
    };

    const onStart = (clientX, clientY, e) => {
        isDragging = true;
        modalEl._didDrag = false;
        startX = clientX;
        startY = clientY;
        initialX = currentX;
        initialY = currentY;

        headerEl.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        panelEl.style.transition = 'none';

        // Calcular límites fijos del viewport al inicio del arrastre
        const rect = panelEl.getBoundingClientRect();
        minX = initialX - rect.left + 16;
        maxX = initialX + (window.innerWidth - rect.right - 16);
        minY = initialY - rect.top + 16;
        maxY = initialY + (window.innerHeight - rect.bottom - 16);
    };

    headerEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, a, input, select, textarea, label')) return;
        e.preventDefault();
        onStart(e.clientX, e.clientY, e);
    });

    const onMove = (clientX, clientY, e) => {
        if (!isDragging) return;
        if (e && e.cancelable) e.preventDefault();

        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            modalEl._didDrag = true;
        }

        currentX = Math.max(minX, Math.min(maxX, initialX + dx));
        currentY = Math.max(minY, Math.min(maxY, initialY + dy));

        panelEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    };

    const onEnd = () => {
        if (isDragging) {
            isDragging = false;
            headerEl.style.cursor = 'grab';
            document.body.style.userSelect = '';
            setTimeout(() => { modalEl._didDrag = false; }, 150);
        }
    };

    document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY, e));
    document.addEventListener('mouseup', onEnd);

    headerEl.addEventListener('touchstart', (e) => {
        if (e.target.closest('button, a, input, select, textarea, label')) return;
        const t = e.touches[0];
        onStart(t.clientX, t.clientY, e);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        onMove(t.clientX, t.clientY, e);
    }, { passive: false });

    document.addEventListener('touchend', onEnd);
}

// Inicializar capacidad de arrastrar en los modales
makeModalDraggable($('#modalUpdate'), $('#modalUpdateHeader'), $('#formUpdate'));
makeModalDraggable($('#modalTicketDetail'), $('#modalTicketDetailHeader') || $('#modalTicketDetail .bg-gradient-to-r'), $('#modalTicketDetail .panel'));

$('#mResolver').addEventListener('click', () => {
    $('#mEstado').value = 'Resuelta';
    const curVal = Number($('#mHoras').value);
    if (!curVal || curVal <= 0) $('#mHoras').value = 1;
    validarHorasInput();
    renderOp();
    $('#mHoras').focus();
});

$('#formUpdate').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editing) return;

    const horasInput = $('#mHoras');

    // Validación estricta que BLOQUEA el guardado si el número es inválido o mayor a 24
    if (!validarHorasInput()) {
        const val = Number(horasInput.value);
        if (val > 24) {
            toast('<b>Operación bloqueada:</b> No puedes guardar más de <b>24 horas</b> en una sola actualización.', 'warn');
        } else {
            toast('<b>Operación bloqueada:</b> Ingresa una cantidad válida de horas (entre <b>0 y 24 horas</b>).', 'warn');
        }
        horasInput.focus();
        return;
    }

    const estado = $('#mEstado').value;
    const horas = Number(horasInput.value.trim());

    if (estado === 'Resuelta' && (Number(editing.horas) + horas <= 0)) {
        horasInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
        const errEl = $('#mHorasError');
        if (errEl) { 
            errEl.textContent = 'Registra al menos 0.5 h antes de marcar como Resuelta.';
            errEl.classList.remove('hidden'); 
        }
        toast('Registra las <b>horas invertidas</b> antes de marcar como Resuelta.', 'warn');
        horasInput.focus();
        return;
    }
    horasInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200');

    const submitBtn = formUpdate.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Guardando...';

    try {
        const tecnicoSeleccionado = TECNICOS.find((t) => t.auth_uid === $('#mTecnico').value) || null;
        
        // Actualización optimista inmediata en la interfaz
        editing.horas = Math.round((Number(editing.horas || 0) + horas) * 10) / 10;
        editing.estado = estado;
        if (tecnicoSeleccionado) {
            editing.tecnico = tecnicoSeleccionado.nombre;
            editing.tecnico_asignado = tecnicoSeleccionado;
        }
        renderGestion();

        const delList = Array.from(evidenciasParaEliminar);

        await apiActualizarEstado(editing.id, {
            estado_nuevo: estado.toLowerCase(),
            horas_invertidas: horas,
            accion: $('#mNota').value.trim() || `Estado actualizado a ${estado}`,
            tecnico_asignado: tecnicoSeleccionado,
            eliminar_evidencias: delList.length > 0 ? delList : undefined
        });

        // Actualizar evidencias en memoria si se eliminaron
        if (delList.length > 0 && Array.isArray(editing.evidencias)) {
            editing.evidencias = editing.evidencias.filter(e => !delList.includes(e.url_storage || e.url));
        }

        toast(`<b>${editing.id}</b> → ${estado} ${horas > 0 ? `(+ ${horas} h acumuladas)` : ''} · <span class="font-mono text-xs">MongoDB Atlas actualizado</span>`, 'ok');
        if (delList.length > 0) {
            toast(`Se eliminó(ron) <b>${delList.length} imagen(es)</b> de Cloudinary y MongoDB Atlas.`, 'info');
        }
        closeModal();
        await cargarIncidenciasDesdeAPI();
    } catch (err) {
        console.error('Error al actualizar estado:', err);
        toast(`Error al actualizar estado: ${err.message}`, 'warn');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
    }
});
