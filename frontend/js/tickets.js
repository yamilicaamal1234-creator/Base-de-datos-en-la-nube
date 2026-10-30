/* =========================================================
   RF-01 · Formulario Polimórfico y Mis Reportes (Conectado a la API)
   ========================================================= */

const form = $('#formReporte');

function buildFormControls() {
    $('#prioridadGroup').innerHTML = PRIORIDADES.map((p, i) => `
    <label class="cursor-pointer">
      <input type="radio" name="prioridad" value="${p.v}" class="peer sr-only" ${i === 1 ? 'checked' : ''} />
      <span class="block text-center text-xs font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-400 transition ${p.cls}">${p.v}</span>
    </label>`).join('');

    $('#categoriaGroup').innerHTML = CATEGORIAS.map((c) => `
    <label class="cursor-pointer">
      <input type="radio" name="categoria" value="${c.v}" class="peer sr-only" />
      <span class="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-gray-200 hover:border-gray-300 transition ${c.ring}">
        <span class="w-10 h-10 rounded-xl grid place-items-center ${c.ic}"><i class="fa-solid ${c.icon}"></i></span>
        <span><span class="block text-sm font-bold text-gray-800">${c.label}</span><span class="block text-[11px] text-gray-500">${c.desc}</span></span>
      </span>
    </label>`).join('');
}

/** Muestra el bloque dinámico de la categoría y oculta/deshabilita los demás. */
function switchCategory(cat) {
    $$('.dyn').forEach((block) => {
        const active = block.dataset.cat === cat;
        block.classList.toggle('open', active);
        $$('input, select, textarea', block).forEach((el) => {
            el.disabled = !active;
            if (el.hasAttribute('data-req')) el.required = active;
        });
    });
    updatePreview();
}

function getDetalle(cat) {
    const v = (id) => $(id) ? $(id).value.trim() : '';
    if (cat === 'redes') return {
        tipo_equipo: v('#r_equipo') || 'PC de escritorio',
        direccion_ip: v('#r_ip') || undefined,
        vlan: v('#r_vlan') || undefined,
        puerto_conexion: v('#r_puerto') || undefined,
    };
    if (cat === 'infra') return {
        tipo_dano: v('#i_danio') || 'Estructural',
        nivel_riesgo: (v('#i_riesgo') || 'medio').toLowerCase(),
        riesgo_descripcion: v('#i_desc') || 'Daño reportado',
        insumos_requeridos: v('#i_insumos') ? v('#i_insumos').split(',').map((s) => s.trim()).filter(Boolean) : [],
        requiere_contratista_externo: $('#i_contratista') ? $('#i_contratista').checked : false,
    };
    if (cat === 'academico') return {
        plataforma: v('#a_plataforma') || 'Moodle',
        periodo_escolar: v('#a_periodo') || 'Sep–Dic 2026',
        estudiantes_afectados: v('#a_estudiantes') ? Number(v('#a_estudiantes')) : 0,
    };
    return {};
}

function suggestTags(cat, det) {
    const t = [];
    if (cat === 'redes') {
        if (det.tipo_equipo) t.push(det.tipo_equipo.toLowerCase().replace(/\s+/g, '-'));
        t.push('sin-red');
    }
    if (cat === 'infra') {
        if (det.tipo_dano) t.push(det.tipo_dano.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'));
    }
    if (cat === 'academico') {
        if (det.plataforma) t.push(det.plataforma.toLowerCase().replace(/\s+/g, '-'));
    }
    return [...new Set(t)];
}

function buildDocument() {
    const fd = new FormData(form);
    const cat = fd.get('categoria');
    const det = cat ? getDetalle(cat) : {};
    const nombreUsuario = currentUser ? currentUser.nombre : USERS[role]?.name || 'Usuario';
    const emailUsuario = currentUser ? currentUser.correo : USERS[role]?.email || 'usuario@utm.edu.mx';

    const doc = {
        _id: { $oid: '…asignado por MongoDB Atlas' },
        codigo: 'INC-2026-XXXX (generado por API)',
        titulo: $('#titulo').value.trim(),
        descripcion: $('#descripcion').value.trim(),
        prioridad: (fd.get('prioridad') || 'Media').toLowerCase(),
        categoria: cat === 'infra' ? 'infraestructura' : (cat || null),
        estado: 'abierta',
        reportante: { nombre: nombreUsuario, correo: emailUsuario },
        detalle_especifico: det,
        tags: suggestTags(cat, det),
        evidencias_adjuntas: uploaded.map(f => ({ nombre: f.name, tamano_kb: Math.round(f.size / 1024), estado: 'Listo para Cloudinary' })),
        horas_invertidas_totales: 0,
        fecha_creacion: { $date: new Date().toISOString() },
    };

    if (cat !== 'academico') {
        doc.ubicacion = { edificio: $('#edificio').value, zona: 'General' };
    }

    return doc;
}

function updatePreview() {
    const el = $('#jsonPreview');
    if (el) el.innerHTML = highlightJSON(buildDocument());
}

if (form) {
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', (e) => {
        if (e.target.name === 'categoria') switchCategory(e.target.value);
        else updatePreview();
    });

    form.addEventListener('reset', () => {
        setTimeout(() => {
            uploaded = [];
            renderFiles();
            switchCategory(null);
            $$('.field', form).forEach((f) => f.classList.remove('border-red-400'));
        }, 0);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cat = new FormData(form).get('categoria');
        let ok = true;
        $$('[required]', form).forEach((el) => {
            const bad = !el.disabled && !el.value.trim();
            el.classList.toggle('border-red-400', bad);
            if (bad) ok = false;
        });
        if (!cat) { ok = false; toast('Selecciona una <b>categoría</b> para continuar.', 'warn'); }
        if (!ok) { toast('Completa los campos obligatorios marcados en rojo.', 'warn'); return; }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando en MongoDB…';

        try {
            const fd = new FormData(form);
            const det = getDetalle(cat);
            const tags = suggestTags(cat, det);

            const payload = {
                titulo: $('#titulo').value.trim(),
                descripcion: $('#descripcion').value.trim(),
                prioridad: fd.get('prioridad') || 'Media',
                categoria: cat === 'infra' ? 'infraestructura' : cat,
                edificio: $('#edificio').value,
                zona: 'Campus',
                detalle_especifico: det,
                tags: tags.length ? tags : ['nuevo']
            };

            const formDataToSend = new FormData();
            formDataToSend.append('datos', JSON.stringify(payload));

            // Si hay un archivo real adjunto, se envía bajo el nombre 'evidencia' (esperado por multer/cloudinary)
            if (uploaded.length > 0 && uploaded[0].file) {
                formDataToSend.append('evidencia', uploaded[0].file);
            }

            const res = await apiCrearIncidencia(formDataToSend);

            toast(`Incidencia <b>${res.codigo}</b> registrada en MongoDB Atlas con éxito.`, 'ok');
            if (res.url_evidencia) {
                toast(`Evidencia subida a Cloudinary: <a href="${res.url_evidencia}" target="_blank" class="underline text-xs">Ver archivo</a>`, 'info');
            }

            form.reset();
            uploaded = [];
            renderFiles();
            switchCategory(null);

            // Refrescar datos desde la API
            await cargarIncidenciasDesdeAPI();

            // Redirigir a vista según el rol
            showView(role === 'Reportante' ? 'mis' : 'gestion');

        } catch (err) {
            console.error('Error al registrar incidencia:', err);
            toast(`Error al registrar en MongoDB: ${err.message}`, 'warn');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    });
}

// ---------- Evidencias y Carga a Cloudinary ----------
const fileInput = $('#evidencias');
const dropZone = $('#dropZone');

function addFiles(files) {
    [...files].forEach((f) => {
        const item = {
            id: Math.random().toString(36).slice(2),
            name: f.name,
            size: f.size,
            type: f.type.split('/')[0] || 'file',
            progress: 100,
            done: true,
            file: f,
            url: URL.createObjectURL(f)
        };
        uploaded.push(item);
    });
    renderFiles();
    updatePreview();
}

function renderFiles() {
    const listEl = $('#fileList');
    if (!listEl) return;
    listEl.innerHTML = uploaded.map((f) => `
    <li class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
      <span class="w-9 h-9 rounded-lg grid place-items-center ${f.done ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}">
        <i class="fa-solid ${f.type === 'video' ? 'fa-film' : 'fa-image'}"></i></span>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between text-xs"><span class="font-semibold text-gray-700 truncate">${esc(f.name)}</span>
          <span class="text-green-700 font-medium ml-2 whitespace-nowrap"><i class="fa-solid fa-cloud-arrow-up"></i> Listo para Cloudinary</span></div>
        <div class="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div class="h-full bg-green-600 w-full"></div></div>
      </div>
      <button type="button" data-rm="${f.id}" class="text-gray-400 hover:text-red-500" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>
    </li>`).join('');
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => { addFiles(e.target.files); fileInput.value = ''; });
    ['dragover', 'dragenter'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('border-green-600', 'bg-green-50'); }));
    ['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('border-green-600', 'bg-green-50'); }));
    dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
    $('#fileList').addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]');
        if (b) { uploaded = uploaded.filter((f) => f.id !== b.dataset.rm); renderFiles(); updatePreview(); }
    });
}

// ---------- Mis reportes ----------
function renderMis() {
    const mine = tickets; // Ya vienen filtradas por la API si el rol es Reportante
    const abiertas = mine.filter((t) => !['Resuelta', 'Cerrada'].includes(t.estado)).length;
    const stat = (icon, label, val, cls) => `
    <div class="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div class="w-12 h-12 rounded-xl grid place-items-center ${cls}"><i class="fa-solid ${icon}"></i></div>
      <div><p class="text-2xl font-extrabold text-gray-900">${val}</p><p class="text-xs text-gray-500">${label}</p></div>
    </div>`;
    $('#misStats').innerHTML = stat('fa-inbox', 'Reportes totales', mine.length, 'bg-green-100 text-green-700')
        + stat('fa-hourglass-half', 'En atención', abiertas, 'bg-amber-100 text-amber-700')
        + stat('fa-circle-check', 'Resueltos / cerrados', mine.length - abiertas, 'bg-sky-100 text-sky-700');

    $('#misList').innerHTML = mine.map((t) => {
        const step = ESTADOS.indexOf(t.estado);
        const evidenciasBadge = t.evidencias && t.evidencias.length
            ? `<a href="${t.evidencias[0].url_storage || '#'}" target="_blank" class="text-xs text-green-700 hover:underline flex items-center gap-1"><i class="fa-solid fa-paperclip"></i> Evidencia</a>`
            : '';
        return `
    <div class="px-6 py-5 hover:bg-gray-50 transition">
      <div class="flex flex-wrap items-center gap-3">
        <span class="font-mono text-xs text-gray-400">${t.id}</span>
        <h3 class="font-semibold text-gray-900">${esc(t.titulo)}</h3>
        ${evidenciasBadge}
        <span class="ml-auto text-xs px-2.5 py-1 rounded-full ring-1 font-semibold ${ESTADO_STYLE[t.estado]?.chip || 'bg-gray-100 text-gray-700'}">${t.estado}</span>
      </div>
      <p class="text-xs text-gray-500 mt-1">${esc(t.descripcion)}</p>
      <div class="mt-4 flex items-center gap-1">
        ${ESTADOS.map((s, i) => `<div class="flex-1"><div class="h-1.5 rounded-full ${i <= step ? 'bg-green-600' : 'bg-gray-200'}"></div><p class="mt-1.5 text-[10px] ${i <= step ? 'text-green-700 font-semibold' : 'text-gray-400'} hidden sm:block">${s}</p></div>`).join('')}
      </div>
    </div>`;
    }).join('') || '<p class="p-8 text-center text-gray-400">Aún no tienes reportes registrados en el sistema.</p>';
}