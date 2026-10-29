/* =========================================================
   RF-06 / RF-07 · Analítica Directiva y Administración (API)
   ========================================================= */

async function renderAnalitica() {
    let stats = null;
    try {
        stats = await apiGetEstadisticas();
    } catch (e) {
        console.warn('Usando datos locales para analítica:', e);
    }

    const total = stats ? stats.total : tickets.length;
    const resueltas = tickets.filter((t) => ['Resuelta', 'Cerrada'].includes(t.estado));
    const avg = stats && stats.total > 0
        ? (stats.horas_tecnicas_invertidas / Math.max(1, resueltas.length || 1)).toFixed(1)
        : (resueltas.length ? (resueltas.reduce((a, t) => a + t.horas, 0) / resueltas.length).toFixed(1) : '0');

    const criticas = tickets.filter((t) => t.prioridad === 'Crítica' && !['Resuelta', 'Cerrada'].includes(t.estado)).length;
    const tasaResolucion = total > 0 ? Math.round((resueltas.length / total) * 100) : 0;

    const kpi = (icon, label, value, trend, up, cls) => `
    <div class="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full ${cls} opacity-10"></div>
      <div class="flex items-center justify-between">
        <span class="w-11 h-11 rounded-xl grid place-items-center ${cls} text-white"><i class="fa-solid ${icon}"></i></span>
        <span class="text-xs font-bold ${up ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'} px-2 py-1 rounded-full"><i class="fa-solid fa-arrow-${up ? 'up' : 'down'} mr-0.5"></i>${trend}</span>
      </div>
      <p class="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">${value}</p>
      <p class="text-sm text-gray-500">${label}</p>
    </div>`;

    $('#kpis').innerHTML =
        kpi('fa-ticket', 'Incidencias registradas', total, 'En vivo', true, 'bg-green-700') +
        kpi('fa-stopwatch', 'Horas promedio de resolución', `${avg} h`, 'En vivo', true, 'bg-emerald-500') +
        kpi('fa-check-double', 'Tasa de resolución', `${tasaResolucion}%`, 'En vivo', true, 'bg-teal-600') +
        kpi('fa-fire', 'Críticas sin resolver', criticas, criticas > 0 ? 'Atención' : 'Óptimo', criticas === 0, 'bg-red-500');

    // RF-06: horas por edificio (calculado por MongoDB Aggregation)
    const edificiosData = (stats && stats.horas_por_edificio && stats.horas_por_edificio.length)
        ? stats.horas_por_edificio.map(item => ({ e: item.edificio, h: item.promedio_horas }))
        : HORAS_EDIFICIO;

    const maxH = Math.max(...edificiosData.map((x) => x.h), 1);
    $('#chartEdificios').innerHTML = edificiosData.map((x) => `
    <div>
      <div class="flex justify-between text-sm mb-1.5"><span class="font-medium text-gray-700"><i class="fa-solid fa-building text-green-700/60 mr-1.5"></i>${x.e}</span><span class="font-bold text-gray-900">${x.h} h</span></div>
      <div class="h-3 rounded-full bg-gray-100 overflow-hidden"><div class="bar h-full rounded-full ${x.h > 7 ? 'bg-gradient-to-r from-amber-400 to-red-500' : 'bg-gradient-to-r from-green-500 to-green-700'}" data-w="${(x.h / maxH) * 100}"></div></div>
    </div>`).join('') || '<p class="text-xs text-gray-400">Sin datos de resolución por edificio aún.</p>';

    // RF-07: top 10 etiquetas (calculado por MongoDB Aggregation)
    const tagsData = (stats && stats.top_tags && stats.top_tags.length)
        ? stats.top_tags.map(t => [t.tag, t.cantidad])
        : TOP_TAGS;

    const maxT = tagsData.length ? Math.max(...tagsData.map(t => t[1]), 1) : 1;
    $('#chartTags').innerHTML = tagsData.map(([tag, n], i) => `
    <li class="flex items-center gap-3">
      <span class="w-7 h-7 shrink-0 rounded-lg grid place-items-center text-xs font-extrabold ${i < 3 ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-500'}">${i + 1}</span>
      <span class="w-36 shrink-0 text-sm font-semibold text-gray-700 truncate">#${tag}</span>
      <div class="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden"><div class="bar h-full rounded-full bg-green-${i < 3 ? '700' : '500'}" data-w="${(n / maxT) * 100}"></div></div>
      <span class="w-8 text-right text-sm font-bold text-gray-900">${n}</span>
    </li>`).join('') || '<p class="text-xs text-gray-400">Sin etiquetas registradas.</p>';

    // Donut de estados
    let acc = 0;
    const segs = ESTADOS.map((s) => {
        let n = 0;
        if (stats && stats.desglose_estados) {
            const encontrado = stats.desglose_estados.find(e => e._id.toLowerCase() === s.toLowerCase());
            n = encontrado ? encontrado.cantidad : 0;
        } else {
            n = tickets.filter((t) => t.estado === s).length;
        }
        const from = acc;
        acc += total > 0 ? (n / total) * 360 : 0;
        return { s, n, seg: `${ESTADO_STYLE[s].color} ${from}deg ${acc}deg` };
    });

    $('#donut').style.background = total > 0 ? `conic-gradient(${segs.map((x) => x.seg).join(',')})` : '#f3f4f6';
    $('#donutTotal').textContent = total;
    $('#donutLegend').innerHTML = segs.map((x) => `
    <li class="flex items-center gap-3 text-sm"><span class="w-3 h-3 rounded-full" style="background:${ESTADO_STYLE[x.s].color}"></span>
      <span class="text-gray-700">${x.s}</span><span class="ml-auto font-bold text-gray-900">${x.n}</span>
      <span class="w-10 text-right text-xs text-gray-400">${total > 0 ? Math.round((x.n / total) * 100) : 0}%</span></li>`).join('');

    // Barras apiladas por semana
    const maxS = Math.max(...SEMANAS.map((w) => w[0] + w[1] + w[2]));
    $('#chartSemanas').innerHTML = SEMANAS.map((w, i) => {
        const tot = w[0] + w[1] + w[2];
        return `
    <div class="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
      <span class="text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition">${tot}</span>
      <div class="w-full max-w-[38px] flex flex-col-reverse rounded-t-lg overflow-hidden transition-all duration-700 origin-bottom scale-y-0" data-grow style="height:${(tot / maxS) * 100}%">
        <div class="bg-green-700" style="flex:${w[0]}"></div><div class="bg-amber-400" style="flex:${w[1]}"></div><div class="bg-sky-400" style="flex:${w[2]}"></div>
      </div>
      <span class="text-[10px] text-gray-400">S${i + 1}</span>
    </div>`;
    }).join('');

    // Animaciones
    requestAnimationFrame(() => setTimeout(() => {
        $$('#view-analitica .bar').forEach((b) => (b.style.width = (b.dataset.w || 0) + '%'));
        $$('#view-analitica [data-grow]').forEach((b, i) => setTimeout(() => b.classList.remove('scale-y-0'), i * 60));
    }, 60));
}

$$('.pipe-btn').forEach((b) => b.addEventListener('click', () => $('#' + b.dataset.target).classList.toggle('hidden')));

// =========================================================
//  ADMINISTRACIÓN CONECTADA A MONGODB
// =========================================================
let usuariosEnDB = [];

async function renderAdmin() {
    try {
        usuariosEnDB = await apiGetUsuarios();
    } catch (err) {
        console.warn('Error al obtener usuarios para admin:', err);
    }

    const card = (icon, title, line1, line2, cls) => `
    <div class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex gap-4">
      <span class="w-12 h-12 rounded-xl grid place-items-center ${cls}"><i class="fa-solid ${icon} text-lg"></i></span>
      <div><p class="font-bold text-gray-900">${title}</p><p class="text-xs text-gray-500 mt-0.5">${line1}</p>
      <p class="text-xs font-semibold text-green-700 mt-2"><i class="fa-solid fa-circle text-[7px] mr-1"></i>${line2}</p></div>
    </div>`;
    $('#adminCards').innerHTML =
        card('fa-leaf', 'MongoDB Atlas', 'Clúster M10 · Colección roles conectada', 'Operativo · Clúster rs0', 'bg-green-100 text-green-700') +
        card('fa-cloud', 'Cloudinary', 'utm_desk_evidencias · API activa', 'Almacenamiento en vivo', 'bg-sky-100 text-sky-700') +
        card('fa-shield-halved', 'Autenticación', 'JWT Bearer Token · Validador activo', `${usuariosEnDB.length} usuarios en roles`, 'bg-amber-100 text-amber-700');

    const roleCls = {
        'reportante': 'bg-gray-100 text-gray-700',
        'tecnico': 'bg-sky-50 text-sky-700',
        'coordinador': 'bg-amber-50 text-amber-700',
        'directivo': 'bg-violet-50 text-violet-700',
        'administrador': 'bg-green-50 text-green-800'
    };

    const rolesOpciones = ['reportante', 'tecnico', 'coordinador', 'directivo', 'administrador'];

    $('#usersBody').innerHTML = usuariosEnDB.map((u) => {
        const nombre = `${u.primer_nombre} ${u.apellido_paterno}`;
        const active = u.activo;
        const rolNorm = (u.rol || 'reportante').toLowerCase();

        return `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-3"><div class="flex items-center gap-3"><span class="w-8 h-8 rounded-full bg-green-700 text-white text-xs font-bold grid place-items-center">${initials(nombre)}</span><span class="font-semibold text-gray-900">${esc(nombre)}</span></div></td>
      <td class="px-6 py-3 text-gray-500">${esc(u.correo)}</td>
      <td class="px-6 py-3">
        <select data-user-uid="${u.auth_uid}" class="text-xs font-semibold rounded-lg border-0 px-2 py-1 ${roleCls[rolNorm] || 'bg-gray-100 text-gray-700'} focus:ring-2 focus:ring-green-300 capitalize cursor-pointer">
          ${rolesOpciones.map((r) => `<option value="${r}" ${r === rolNorm ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join('')}
        </select>
      </td>
      <td class="px-6 py-3">
        <button data-toggle-uid="${u.auth_uid}" class="relative w-11 h-6 rounded-full transition ${active ? 'bg-green-600' : 'bg-gray-300'}" aria-label="Activar o desactivar">
          <span class="absolute top-0.5 ${active ? 'left-[22px]' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all"></span>
        </button>
      </td>
    </tr>`;
    }).join('') || '<tr><td colspan="4" class="p-6 text-center text-gray-400">Sin usuarios en base de datos.</td></tr>';
}

$('#usersBody').addEventListener('change', async (e) => {
    const s = e.target.closest('[data-user-uid]');
    if (!s) return;
    const auth_uid = s.dataset.userUid;
    const nuevoRol = s.value;

    try {
        await apiActualizarUsuario(auth_uid, { rol: nuevoRol });
        toast(`Rol actualizado a <b>${nuevoRol}</b> en MongoDB Atlas.`, 'ok');
        await renderAdmin();
    } catch (err) {
        toast(`Error al actualizar rol: ${err.message}`, 'warn');
    }
});

$('#usersBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-toggle-uid]');
    if (!b) return;
    const auth_uid = b.dataset.toggleUid;
    const user = usuariosEnDB.find(u => u.auth_uid === auth_uid);
    if (!user) return;

    const nuevoEstado = !user.activo;

    try {
        await apiActualizarUsuario(auth_uid, { activo: nuevoEstado });
        toast(`Usuario <b>${user.primer_nombre}</b> ${nuevoEstado ? 'activado' : 'desactivado'}.`, nuevoEstado ? 'ok' : 'info');
        await renderAdmin();
    } catch (err) {
        toast(`Error al cambiar estado: ${err.message}`, 'warn');
    }
});

const modalAddUser = $('#modalAddUser');
const formAddUser = $('#formAddUser');
const addRol = $('#addRol');
const addPerfilWrap = $('#addPerfilWrap');

function closeAddUserModal() {
    modalAddUser.classList.remove('show');
    formAddUser.reset();
}

$('#btnAddUser').addEventListener('click', () => {
    formAddUser.reset();
    addPerfilWrap.classList.remove('hidden');
    modalAddUser.classList.add('show');
    setTimeout(() => $('#addPrimerNombre').focus(), 200);
});

$('#btnCancelAddUser').addEventListener('click', closeAddUserModal);
modalAddUser.addEventListener('click', (e) => {
    if (e.target === modalAddUser) closeAddUserModal();
});

addRol.addEventListener('change', () => {
    addPerfilWrap.classList.toggle('hidden', addRol.value !== 'reportante');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalAddUser.classList.contains('show')) closeAddUserModal();
});

formAddUser.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = $('#addPassword').value;
    const passwordConfirm = $('#addPasswordConfirm').value;
    if (password.length < 8) {
        toast('La contraseña debe tener al menos <b>8 caracteres</b>.', 'warn');
        $('#addPassword').focus();
        return;
    }
    if (password !== passwordConfirm) {
        toast('Las contraseñas <b>no coinciden</b>.', 'warn');
        $('#addPasswordConfirm').focus();
        return;
    }

    const payload = {
        primer_nombre: $('#addPrimerNombre').value.trim(),
        apellido_paterno: $('#addApellidoPaterno').value.trim(),
        correo: $('#addCorreo').value.trim(),
        rol: addRol.value,
        perfil: $('#addPerfil').value,
        password,
        password_confirm: passwordConfirm,
        activo: true
    };

    const submitBtn = formAddUser.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando usuario…';

    try {
        await apiCrearUsuario(payload);
        toast(`Usuario <b>${payload.primer_nombre} ${payload.apellido_paterno}</b> creado en MongoDB Atlas.`, 'ok');
        closeAddUserModal();
        await renderAdmin();
    } catch (err) {
        toast(`Error al crear usuario: ${err.message}`, 'warn');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
    }
});

// =========================================================
//  INIT
// =========================================================
buildFormControls();
switchCategory(null);
showView('reporte');