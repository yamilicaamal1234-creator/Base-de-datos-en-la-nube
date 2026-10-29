/* =========================================================
   Navegación y Roles
   ========================================================= */

function renderNav() {
    const items = NAV.filter((n) => n.roles.includes(role));
    $('#nav').innerHTML =
        `<p class="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.2em] text-green-300/80">Menú · ${role}</p>` +
        items.map((n) => `
      <button data-goto="${n.id}" class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-green-100 hover:bg-white/10 hover:text-white transition ${n.id === currentView ? 'active' : ''}">
        <i class="fa-solid ${n.icon} w-5 text-center"></i><span>${n.label}</span>
        ${n.id === 'gestion' ? `<span class="ml-auto text-[10px] font-bold bg-white text-green-800 rounded-full px-2 py-0.5">${tickets.filter((t) => !['Resuelta', 'Cerrada'].includes(t.estado)).length}</span>` : ''}
      </button>`).join('');
}

function setRole(r, silent = false) {
    role = r;
    const displayName = (currentUser && currentUser.nombre) ? currentUser.nombre : (USERS[r] ? USERS[r].name : r);
    $('#userName').textContent = displayName;
    $('#userRole').textContent = r;
    $('#avatar').textContent = initials(displayName);
    $('#mineWrap').classList.toggle('hidden', r !== 'Técnico');
    $('#onlyMine').checked = r === 'Técnico';
    const allowed = NAV.filter((n) => n.roles.includes(r)).map((n) => n.id);
    showView(allowed.includes(currentView) ? currentView : DEFAULT_VIEW[r]);
    if (!silent) toast(`Vista cambiada a rol <b>${r}</b>`, 'info');
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
$('#roleSelect').addEventListener('change', (e) => setRole(e.target.value));

// Sidebar móvil
const openSidebar = () => { $('#sidebar').classList.remove('-translate-x-full'); $('#overlay').classList.remove('hidden'); };
const closeSidebar = () => { $('#sidebar').classList.add('-translate-x-full'); $('#overlay').classList.add('hidden'); };
$('#btnMenu').addEventListener('click', openSidebar);
$('#overlay').addEventListener('click', closeSidebar);