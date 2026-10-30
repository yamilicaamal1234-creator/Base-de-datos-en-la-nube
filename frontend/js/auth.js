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
        if (typeof renderRoleSwitcher === 'function') renderRoleSwitcher();

        // Ocultar pantalla de login y mostrar app principal
        loginScreen.classList.add('hidden-login');
        appMain.classList.remove('hidden');
        if (bgAnimController) bgAnimController.stop();

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
            if (typeof renderRoleSwitcher === 'function') renderRoleSwitcher();
            if (bgAnimController) bgAnimController.start();
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

    // =========================================================
    // Movimiento interactivo del Logo del Login al tocarlo
    // =========================================================
    const loginLogo = $('#loginLogo');
    if (loginLogo) {
        loginLogo.addEventListener('pointerdown', () => {
            loginLogo.classList.remove('logo-moving');
            void loginLogo.offsetWidth; // Forzar reinicio de animación
            loginLogo.classList.add('logo-moving');
        });

        loginLogo.addEventListener('animationend', () => {
            loginLogo.classList.remove('logo-moving');
        });
    }

    // =========================================================
    // Fondo Interactivo de Mesa de Ayuda (Canvas con Nodos y Tickets)
    // =========================================================
    let bgAnimController = null;

    function initLoginBackgroundAnimation() {
        const canvas = document.getElementById('loginCanvas');
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let width = 0;
        let height = 0;
        let dpr = window.devicePixelRatio || 1;
        let animId = null;
        let isRunning = false;

        const mouse = { x: -9999, y: -9999, active: false, radius: 160 };
        const ripples = [];

        // Nombres temáticos para nodos de la Mesa de Ayuda UTM
        const nodeLabels = [
            'Edif. C', 'Edif. J', 'Edif. F', 'Edif. G', 'Edif. M', 'Edif. T', 'Edif. N', 'Edif. R',
            'Vinculación', 'Pesado 1', 'Pesado 2', 'Rectoría', 'Escolares', 'Biblioteca',
            'SLA 98%', 'Atlas NoSQL', 'Ticket #1024', 'Ticket #1025', 'Router UTM', 'Switch Central',
            'AP WiFi-6', 'Gateway', 'Soporte N1', 'Soporte N2'
        ];

        let nodes = [];

        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            dpr = Math.min(window.devicePixelRatio || 1, 2);

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);

            createNodes();
        }

        function createNodes() {
            const count = Math.min(Math.floor((width * height) / 22000), 55);
            nodes = [];

            for (let i = 0; i < count; i++) {
                const label = i < nodeLabels.length ? nodeLabels[i] : null;
                const isTicket = label && label.startsWith('Ticket');
                const isServer = label && (label.includes('Atlas') || label.includes('Switch') || label.includes('Router'));

                nodes.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.6,
                    vy: (Math.random() - 0.5) * 0.6,
                    radius: isServer ? 3.5 : (isTicket ? 3 : (Math.random() * 1.5 + 1.8)),
                    label: label,
                    isTicket: isTicket,
                    isServer: isServer,
                    color: isTicket ? '#fbbf24' : (isServer ? '#38bdf8' : '#34d399'),
                    pulse: Math.random() * Math.PI * 2,
                    pulseSpeed: 0.03 + Math.random() * 0.02
                });
            }
        }

        function addRipple(x, y) {
            ripples.push({
                x,
                y,
                r: 5,
                maxR: 180,
                alpha: 0.7,
                speed: 3.5
            });
        }

        // Eventos del ratón
        const screen = document.getElementById('loginScreen');
        if (screen) {
            screen.addEventListener('pointermove', (e) => {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
                mouse.active = true;
            });

            screen.addEventListener('pointerleave', () => {
                mouse.active = false;
                mouse.x = -9999;
                mouse.y = -9999;
            });

            screen.addEventListener('pointerdown', (e) => {
                // Solo si el clic no es dentro del formulario
                const card = document.getElementById('loginCard');
                if (card && card.contains(e.target)) return;
                addRipple(e.clientX, e.clientY);
            });
        }

        window.addEventListener('resize', () => {
            if (isRunning) resize();
        });

        function step() {
            if (!isRunning) return;

            ctx.clearRect(0, 0, width, height);

            // 1. Actualizar y dibujar ondas (ripples al hacer clic)
            for (let i = ripples.length - 1; i >= 0; i--) {
                const rp = ripples[i];
                rp.r += rp.speed;
                rp.alpha *= 0.95;

                ctx.beginPath();
                ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(52, 211, 153, ${rp.alpha})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Ondas empujan ligeramente los nodos
                for (const node of nodes) {
                    const dx = node.x - rp.x;
                    const dy = node.y - rp.y;
                    const dist = Math.hypot(dx, dy);
                    if (Math.abs(dist - rp.r) < 25) {
                        const force = (1 - Math.abs(dist - rp.r) / 25) * 0.8;
                        node.vx += (dx / (dist || 1)) * force;
                        node.vy += (dy / (dist || 1)) * force;
                    }
                }

                if (rp.alpha < 0.02 || rp.r > rp.maxR) {
                    ripples.splice(i, 1);
                }
            }

            // 2. Actualizar posiciones de nodos
            for (const node of nodes) {
                node.x += node.vx;
                node.y += node.vy;
                node.pulse += node.pulseSpeed;

                // Fricción suave
                node.vx *= 0.99;
                node.vy *= 0.99;

                // Rebote en bordes con margen
                if (node.x < 10) { node.x = 10; node.vx *= -1; }
                if (node.x > width - 10) { node.x = width - 10; node.vx *= -1; }
                if (node.y < 10) { node.y = 10; node.vy *= -1; }
                if (node.y > height - 10) { node.y = height - 10; node.vy *= -1; }

                // Repulsión / atracción sutil con el ratón
                if (mouse.active) {
                    const dx = mouse.x - node.x;
                    const dy = mouse.y - node.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < mouse.radius && dist > 1) {
                        const force = (1 - dist / mouse.radius) * 0.4;
                        node.vx -= (dx / dist) * force;
                        node.vy -= (dy / dist) * force;
                    }
                }
            }

            // 3. Dibujar conexiones entre nodos (topología de red de soporte)
            const maxDist = 115;
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < maxDist) {
                        const alpha = (1 - dist / maxDist) * 0.22;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = `rgba(110, 231, 183, ${alpha})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }

            // 4. Dibujar conexiones interactivas con el cursor
            if (mouse.active) {
                // Aura alrededor del cursor
                const auraGradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouse.radius);
                auraGradient.addColorStop(0, 'rgba(52, 211, 153, 0.12)');
                auraGradient.addColorStop(1, 'rgba(52, 211, 153, 0)');
                ctx.fillStyle = auraGradient;
                ctx.beginPath();
                ctx.arc(mouse.x, mouse.y, mouse.radius, 0, Math.PI * 2);
                ctx.fill();

                // Conexiones del cursor a nodos cercanos
                for (const node of nodes) {
                    const dx = mouse.x - node.x;
                    const dy = mouse.y - node.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < mouse.radius) {
                        const alpha = (1 - dist / mouse.radius) * 0.55;
                        ctx.beginPath();
                        ctx.moveTo(mouse.x, mouse.y);
                        ctx.lineTo(node.x, node.y);
                        ctx.strokeStyle = `rgba(52, 211, 153, ${alpha})`;
                        ctx.lineWidth = 1.4;
                        ctx.stroke();
                    }
                }
            }

            // 5. Dibujar los nodos y etiquetas de Mesa de Ayuda
            for (const node of nodes) {
                const pulseScale = 1 + Math.sin(node.pulse) * 0.25;

                // Halo de brillo
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius * pulseScale * 2.2, 0, Math.PI * 2);
                ctx.fillStyle = node.color === '#fbbf24'
                    ? 'rgba(251, 191, 36, 0.18)'
                    : (node.color === '#38bdf8' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(52, 211, 153, 0.18)');
                ctx.fill();

                // Punto central
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.fill();

                // Si tiene etiqueta y está cerca del ratón o es especial, mostrar texto sutil
                if (node.label) {
                    const dx = mouse.active ? mouse.x - node.x : 999;
                    const dy = mouse.active ? mouse.y - node.y : 999;
                    const distToMouse = Math.hypot(dx, dy);
                    const shouldShow = node.isServer || node.isTicket || distToMouse < 130;

                    if (shouldShow) {
                        const textAlpha = distToMouse < 130 ? 0.9 : 0.45;
                        ctx.font = '500 10px Inter, sans-serif';
                        ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
                        ctx.textAlign = 'left';
                        ctx.fillText(node.label, node.x + 8, node.y + 3);
                    }
                }
            }

            animId = requestAnimationFrame(step);
        }

        function start() {
            if (!isRunning) {
                isRunning = true;
                resize();
                step();
            }
        }

        function stop() {
            isRunning = false;
            if (animId) {
                cancelAnimationFrame(animId);
                animId = null;
            }
        }

        return { start, stop };
    }

    // Inicializar y arrancar fondo interactivo
    bgAnimController = initLoginBackgroundAnimation();
    if (bgAnimController && !loginScreen.classList.contains('hidden-login')) {
        bgAnimController.start();
    }

    // Toggle de visibilidad de contraseña
    const btnTogglePass = $('#btnTogglePass');
    if (btnTogglePass && inputPass) {
        btnTogglePass.addEventListener('click', (e) => {
            e.preventDefault();
            const esPassword = inputPass.type === 'password';
            inputPass.type = esPassword ? 'text' : 'password';
            btnTogglePass.innerHTML = esPassword
                ? '<i class="fa-regular fa-eye-slash text-sm text-green-700"></i>'
                : '<i class="fa-regular fa-eye text-sm text-gray-400"></i>';
        });
    }
});