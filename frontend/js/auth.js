/* =========================================================
   Módulo de Autenticación / Login Conectado a la API
   ========================================================= */

const ROL_MAP_BACK_TO_FRONT = {
    'reportante': 'Reportante',
    'tecnico': 'Técnico',
    'coordinador': 'Coordinador',
    'directivo': 'Directivo',
    'administrador': 'Administrador',
};

document.addEventListener('DOMContentLoaded', async () => {
    const loginScreen = $('#loginScreen');
    const appMain = $('#appMain');
    const formLogin = $('#formLogin');
    const inputEmail = $('#loginEmail');
    const inputPass = $('#loginPassword');
    const errEmail = $('#errEmail');
    const errPass = $('#errPassword');
    const loginError = $('#loginError');
    const btnLogout = $('#btnLogout');

    function clearErrors() {
        errEmail.classList.add('hidden');
        errPass.classList.add('hidden');
        loginError.classList.add('hidden');
        inputEmail.classList.remove('border-red-400');
        inputPass.classList.remove('border-red-400');
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    async function aplicarSesionUsuario(token, usuario) {
        setSession(token, usuario);
        currentUser = usuario;

        const rolFrontend = ROL_MAP_BACK_TO_FRONT[(usuario.rol || '').toLowerCase()] || 'Reportante';

        // Actualizar información visual del usuario
        $('#userName').textContent = usuario.nombre || `${usuario.primer_nombre} ${usuario.apellido_paterno}`;
        $('#userRole').textContent = rolFrontend;
        $('#avatar').textContent = initials(usuario.nombre || `${usuario.primer_nombre} ${usuario.apellido_paterno}`);

        // Configuración de restricciones según rol
        const roleSelect = $('#roleSelect');
        const roleWrapper = roleSelect ? roleSelect.closest('.relative') : null;
        const isAdmin = rolFrontend === 'Administrador';
        if (roleSelect && roleWrapper) {
            roleWrapper.style.display = isAdmin ? 'block' : 'none';
            roleSelect.value = rolFrontend;
        }

        setRole(rolFrontend, true);

        // Ocultar pantalla de login y mostrar app principal
        loginScreen.classList.add('hidden-login');
        appMain.classList.remove('hidden');

        // Cargar incidencias reales desde MongoDB Atlas
        await cargarIncidenciasDesdeAPI();
    }

    // Submit del formulario de Login conectado al backend
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const email = inputEmail.value.trim();
            const pass = inputPass.value.trim();
            let isValid = true;

            if (!email) {
                errEmail.textContent = 'Ingresa tu correo electrónico.';
                errEmail.classList.remove('hidden');
                inputEmail.classList.add('border-red-400');
                isValid = false;
            } else if (!validateEmail(email)) {
                errEmail.textContent = 'Formato de correo no válido (ej. usuario@utm.edu.mx).';
                errEmail.classList.remove('hidden');
                inputEmail.classList.add('border-red-400');
                isValid = false;
            }

            if (!isValid) return;

            const submitBtn = formLogin.querySelector('button[type="submit"]');
            const originalBtnHTML = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando…';

            try {
                const res = await apiLogin(email, pass);
                await aplicarSesionUsuario(res.token, res.usuario);
                toast(`Sesión iniciada con éxito como <b>${res.usuario.nombre}</b> (${res.usuario.rol})`, 'ok');
            } catch (err) {
                loginError.textContent = err.message || 'No fue posible iniciar sesión. Verifica tus credenciales.';
                loginError.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
            }
        });
    }

    // Evento CERRAR SESIÓN
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            clearSession();
            currentUser = null;
            tickets = [];
            appMain.classList.add('hidden');
            loginScreen.classList.remove('hidden-login');
            if (formLogin) formLogin.reset();
            clearErrors();
            toast('Has cerrado sesión.', 'info');
        });
    }

    // Restaurar sesión si ya existe token válido
    const savedToken = getToken();
    const savedUserJson = localStorage.getItem('utm_user');
    if (savedToken && savedUserJson) {
        try {
            const usuario = JSON.parse(savedUserJson);
            await aplicarSesionUsuario(savedToken, usuario);
        } catch (e) {
            clearSession();
        }
    }
});