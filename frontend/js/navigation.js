/* =========================================================
   Navegación y Roles
   ========================================================= */

function getNavBadgeCount(navId) {
    const miNombre = currentUser ? (currentUser.nombre || `${currentUser.primer_nombre} ${currentUser.apellido_paterno}`) : USERS[role]?.name;
    if (navId === 'gestion') {
        if (role === 'Técnico') {
            return tickets.filter((t) => t.tecnico === miNombre).length;
        }
        return tickets.filter((t) => !['Resuelta', 'Cerrada'].includes(t.estado)).length;
    }
    if (navId === 'mis') {
        return tickets.length;
    }
    return null;
}

function renderNav() {
    const items = NAV.filter((n) => n.roles.includes(role));
    $('#nav').innerHTML =
        `<p class="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.2em] text-green-300/80">Menú · ${role}</p>` +
        items.map((n) => {
            const count = getNavBadgeCount(n.id);
            const badge = (count !== null && count !== undefined)
                ? `<span class="ml-auto text-[10px] font-bold bg-white text-green-800 rounded-full px-2 py-0.5">${count}</span>`
                : '';
            return `
      <button data-goto="${n.id}" class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-green-100 hover:bg-white/10 hover:text-white transition ${n.id === currentView ? 'active' : ''}">
        <i class="fa-solid ${n.icon} w-5 text-center"></i><span>${n.label}</span>
        ${badge}
      </button>`;
        }).join('');
}

function openSidebar() {
    $('#sidebar').classList.remove('-translate-x-full');
    $('#overlay').classList.remove('hidden');
}

function closeSidebar() {
    $('#sidebar').classList.add('-translate-x-full');
    $('#overlay').classList.add('hidden');
}

const ROLES_INFO = [
    { id: 'Administrador', icon: 'fa-sliders', desc: 'Control total de la plataforma y administración' },
    { id: 'Coordinador', icon: 'fa-user-tie', desc: 'Asignación técnica y analítica institucional' },
    { id: 'Técnico', icon: 'fa-screwdriver-wrench', desc: 'Tablero Kanban y resolución atómica' },
    { id: 'Directivo', icon: 'fa-chart-pie', desc: 'Indicadores ejecutivos y reportes directivos' },
    { id: 'Reportante', icon: 'fa-user-pen', desc: 'Creación y seguimiento de reportes' }
];

function isUserAdmin() {
    return currentUser && (currentUser.rol || '').toLowerCase() === 'administrador';
}

function renderRoleSwitcher() {
    const btn = $('#btnUserProfile');
    const chevron = $('#userRoleChevron');
    const dropdown = $('#roleDropdown');
    const list = $('#roleOptionsList');
    if (!btn || !dropdown || !list) return;

    const isOriginalAdmin = isUserAdmin();

    if (!isOriginalAdmin) {
        if (chevron) chevron.classList.add('hidden');
        btn.classList.remove('hover:bg-gray-100', 'cursor-pointer');
        btn.classList.add('cursor-default');
        btn.removeAttribute('title');
        dropdown.classList.add('hidden');
        return;
    }

    // Si es Administrador, permitir cambiar el rol de su propia cuenta
    if (chevron) chevron.classList.remove('hidden');
    btn.classList.add('hover:bg-gray-100', 'cursor-pointer');
    btn.classList.remove('cursor-default');
    btn.setAttribute('title', 'Haz clic para cambiar el rol de tu cuenta');

    list.innerHTML = ROLES_INFO.map((item) => {
        const isActive = item.id === role;
        return `
        <button type="button" data-switch-role="${item.id}"
            class="w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition ${isActive ? 'bg-green-50 text-green-900 font-semibold ring-1 ring-green-200' : 'hover:bg-gray-50 text-gray-700'}">
            <span class="w-8 h-8 rounded-lg grid place-items-center text-xs shrink-0 ${isActive ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-500'}">
                <i class="fa-solid ${item.icon}"></i>
            </span>
            <div class="flex-1 min-w-0 leading-tight">
                <div class="flex items-center justify-between">
                    <p class="text-xs font-bold truncate">${item.id}</p>
                    ${isActive ? '<span class="text-[10px] text-green-700 font-bold bg-green-100 px-1.5 py-0.5 rounded-md">Activo</span>' : ''}
                </div>
                <p class="text-[11px] text-gray-500 truncate">${item.desc}</p>
            </div>
        </button>`;
    }).join('');
}

function setRole(r, silent = false) {
    role = r;
    // La identidad siempre es la cuenta del usuario autenticado (ej. Lizandro Reyes)
    const displayName = (currentUser && currentUser.nombre) ? currentUser.nombre : (USERS[r] ? USERS[r].name : r);

    $('#userName').textContent = displayName;
    $('#userRole').textContent = r;
    $('#avatar').textContent = initials(displayName);
    $('#mineWrap').classList.toggle('hidden', r !== 'Técnico');
    $('#onlyMine').checked = r === 'Técnico';
    const allowed = NAV.filter((n) => n.roles.includes(r)).map((n) => n.id);
    showView(allowed.includes(currentView) ? currentView : DEFAULT_VIEW[r]);
    if (typeof generarNotificaciones === 'function') generarNotificaciones();
    renderRoleSwitcher();
    if (!silent) toast(`Rol de tu cuenta cambiado a <b>${r}</b>`, 'info');
}

function showView(id) {
    currentView = id;
    const n = NAV.find((x) => x.id === id);
    $('#pageTitle').textContent = n.label;
    $('#pageSub').textContent = n.sub;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${id}`));
    renderNav();
    if (id === 'gestion') renderGestion();
    if (id === 'mis') renderMis();
    if (id === 'analitica') renderAnalitica();
    if (id === 'admin') renderAdmin();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) showView(g.dataset.goto);
});

// Eventos del dropdown de cambio de perfil (Solo Administrador)
const btnUserProfile = $('#btnUserProfile');
const roleDropdown = $('#roleDropdown');

if (btnUserProfile && roleDropdown) {
    btnUserProfile.addEventListener('click', (e) => {
        if (!isUserAdmin()) return;
        e.stopPropagation();
        const willOpen = roleDropdown.classList.contains('hidden');
        roleDropdown.classList.toggle('hidden');
        const chevron = $('#userRoleChevron');
        if (chevron) {
            chevron.classList.toggle('rotate-180', willOpen);
        }
    });

    document.addEventListener('click', (e) => {
        if (!roleDropdown.contains(e.target) && !btnUserProfile.contains(e.target)) {
            roleDropdown.classList.add('hidden');
            const chevron = $('#userRoleChevron');
            if (chevron) chevron.classList.remove('rotate-180');
        }
    });

    roleDropdown.addEventListener('click', (e) => {
        const switchBtn = e.target.closest('[data-switch-role]');
        if (!switchBtn) return;
        const targetRole = switchBtn.dataset.switchRole;
        roleDropdown.classList.add('hidden');
        const chevron = $('#userRoleChevron');
        if (chevron) chevron.classList.remove('rotate-180');
        setRole(targetRole);
    });
}

// Sidebar móvil
if ($('#btnMenu')) $('#btnMenu').addEventListener('click', openSidebar);
if ($('#overlay')) $('#overlay').addEventListener('click', closeSidebar);