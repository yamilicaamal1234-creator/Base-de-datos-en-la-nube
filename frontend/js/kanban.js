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
        ? `<a href="${t.evidencias[0].url_storage || '#'}" target="_blank" onclick="event.stopPropagation()" class="text-[11px] text-green-700 hover:text-green-900 font-semibold flex items-center gap-1" title="Ver archivo en Cloudinary"><i class="fa-solid fa-cloud-arrow-up"></i> Evidencia</a>`
        : '';

    return `
  <article draggable="true" data-id="${t.id}" class="k-card relative bg-white rounded-xl border border-gray-200 p-4 pl-5 cursor-grab overflow-hidden">
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
      <span class="text-[11px] text-gray-500"><i class="fa-regular fa-clock mr-1"></i>${t.horas} h</span>
      <button data-edit="${t.id}" class="ml-auto text-[11px] font-bold text-green-700 hover:text-white hover:bg-green-700 border border-green-200 px-2.5 py-1 rounded-lg transition">
        <i class="fa-solid fa-bolt mr-1"></i>Actualizar</button>
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
    <tr class="hover:bg-green-50/40 transition">
      <td class="px-5 py-3 font-mono text-xs text-gray-500">${t.id}</td>
      <td class="px-5 py-3"><p class="font-semibold text-gray-900">${esc(t.titulo)}</p><div class="mt-1 flex flex-wrap gap-1">${tagChips(t.tags)}</div></td>
      <td class="px-5 py-3 text-gray-600 whitespace-nowrap"><i class="fa-solid ${CAT_ICON[t.categoria] || 'fa-tag'} mr-1.5 text-gray-400"></i>${CAT_LABEL[t.categoria] || t.categoria}</td>
      <td class="px-5 py-3"><span class="text-xs px-2 py-0.5 rounded font-bold ${prio(t.prioridad).chip}">${t.prioridad}</span></td>
      <td class="px-5 py-3"><span class="text-xs px-2.5 py-1 rounded-full ring-1 font-semibold whitespace-nowrap ${ESTADO_STYLE[t.estado]?.chip || ''}">${t.estado}</span></td>
      <td class="px-5 py-3 text-gray-700 whitespace-nowrap">${t.tecnico}</td>
      <td class="px-5 py-3 text-right font-semibold">${t.horas} h</td>
      <td class="px-5 py-3 text-right"><button data-edit="${t.id}" class="text-green-700 hover:text-green-900 font-semibold text-xs whitespace-nowrap"><i class="fa-solid fa-bolt mr-1"></i>Actualizar</button></td>
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
$('#kanban').addEventListener('dragstart', (e) => {
    const c = e.target.closest('.k-card'); if (!c) return;
    dragId = c.dataset.id; c.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
});
$('#kanban').addEventListener('dragend', (e) => { e.target.closest('.k-card')?.classList.remove('dragging'); });
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

document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) openModal(b.dataset.edit);
});

// ---------- Modal de actualización atómica ----------
const modal = $('#modalUpdate');

function openModal(id, presetEstado) {
    editing = tickets.find((t) => t.id === id);
    if (!editing) return;
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
    $('#mHoras').value = 0;
    $('#mNota').value = '';
    $('#mHorasActual').textContent = `Acumulado actual: ${editing.horas} h`;
    renderOp();
    modal.classList.add('show');
    setTimeout(() => $('#mHoras').focus(), 200);
}
const closeModal = () => { modal.classList.remove('show'); editing = null; };

function renderOp() {
    if (!editing) return;
    const nuevoEstado = $('#mEstado').value;
    const horasASumar = Number($('#mHoras').value) || 0;
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

    $('#mOp').innerHTML = `<span class="text-gray-400">db.incidencias_campus.</span><span class="text-green-300">updateOne</span>(\n` +
        `  ${highlightJSON({ codigo: editing.id })},\n  ${highlightJSON(upd).replace(/\n/g, '\n  ')}\n)`;
}

['input', 'change'].forEach((ev) => modal.addEventListener(ev, renderOp));
$$('[data-close]', modal).forEach((b) => b.addEventListener('click', closeModal));
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('show')) closeModal(); });

$('#mResolver').addEventListener('click', () => {
    $('#mEstado').value = 'Resuelta';
    if (!Number($('#mHoras').value)) $('#mHoras').value = 1;
    renderOp();
    $('#mHoras').focus();
});

$('#formUpdate').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editing) return;

    const estado = $('#mEstado').value;
    const horas = Number($('#mHoras').value) || 0;
    if (horas < 0) { toast('Las horas no pueden ser negativas.', 'warn'); return; }
    if (estado === 'Resuelta' && editing.horas + horas <= 0) {
        $('#mHoras').classList.add('border-red-400');
        toast('Registra las <b>horas invertidas</b> antes de marcar como Resuelta.', 'warn');
        return;
    }
    $('#mHoras').classList.remove('border-red-400');

    const submitBtn = formUpdate.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Actualizando en MongoDB…';

    try {
        const tecnicoSeleccionado = TECNICOS.find((t) => t.auth_uid === $('#mTecnico').value) || null;
        await apiActualizarEstado(editing.id, {
            estado_nuevo: estado.toLowerCase(),
            horas_invertidas: horas,
            accion: $('#mNota').value.trim() || `Estado actualizado a ${estado}`,
            tecnico_asignado: tecnicoSeleccionado
        });

        toast(`<b>${editing.id}</b> → ${estado} (+${horas} h) · <span class="font-mono text-xs">MongoDB Atlas actualizado</span>`, 'ok');
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