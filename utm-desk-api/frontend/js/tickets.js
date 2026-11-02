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


// ---------- Validaciones de red para Cómputo / Redes ----------
function isValidIPv4(ip) {
    const str = String(ip || '').trim();
    if (!str) return true; // Opcional si está vacío
    const parts = str.split('.');
    if (parts.length !== 4) return false;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return false;
        const n = Number(part);
        if (n < 0 || n > 255) return false;
        if (part.length > 1 && part.startsWith('0')) return false; // Evitar octetos tipo 01
    }
    return true;
}

function isValidVLAN(vlan) {
    const str = String(vlan || '').trim();
    if (!str) return true; // Opcional si está vacío
    if (!/^\d+$/.test(str)) return false;
    const n = Number(str);
    return Number.isInteger(n) && n >= 1 && n <= 4094;
}

function isValidPuerto(puerto) {
    const str = String(puerto || '').trim();
    if (!str) return true; // Opcional si está vacío
    if (str.length > 25) return false;
    
    // Si es solo un número: puerto de switch 1 a 96
    if (/^\d+$/.test(str)) {
        const n = Number(str);
        return n >= 1 && n <= 96;
    }
    
    // 1. Interfaces de switch/router: Gi1/0/24, Fa0/1, Eth0/1, 1/0/24, 0/24, ge-0/0/1, Te1/1
    const switchInterfaceRegex = /^(?:(?:Gi|Fa|Te|Fo|Eth|FastEthernet|GigabitEthernet|ge|fe|xe)[s-]?)?\d{1,2}(?:[\/\-]\d{1,2}){1,3}$/i;
    if (switchInterfaceRegex.test(str)) return true;
    
    // 2. Puerto con etiqueta o prefijo: Puerto 24, Port 12, P-24, P24, P01, Jack 5, Roseta 12, J-12, A-24, PP-01-24
    const portLabelRegex = /^(?:Puerto|Port|P|Jack|Roseta|J|PP|Panel|Rack)[s-]?[A-Za-z0-9]{1,4}(?:[\-\/][A-Za-z0-9]{1,4})*$/i;
    if (portLabelRegex.test(str)) return true;
    
    // 3. Formato simple de rack/patch: A-12, B/24, 1-24
    const simpleRackRegex = /^[A-Za-z0-9]{1,3}[\-\/][A-Za-z0-9]{1,4}$/;
    if (simpleRackRegex.test(str)) return true;
    
    return false;
}

function validarCampoRedIndividual(fieldId, errorId, errorTextId, validatorFn, errorMsg) {
    const input = $(fieldId);
    const errEl = $(errorId);
    const errText = $(errorTextId);
    if (!input) return true;

    const val = input.value.trim();
    if (!val) {
        input.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
        if (errEl) errEl.classList.add('hidden');
        return true;
    }

    const isValid = validatorFn(val);
    if (!isValid) {
        input.classList.add('border-red-500', 'ring-2', 'ring-red-200');
        if (errEl) {
            if (errText) errText.textContent = errorMsg;
            errEl.classList.remove('hidden');
        }
        return false;
    } else {
        input.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
        if (errEl) errEl.classList.add('hidden');
        return true;
    }
}

function validarCamposRedes() {
    const cat = new FormData(form).get('categoria');
    if (cat !== 'redes') return true;

    const ipOk = validarCampoRedIndividual('#r_ip', '#r_ip_error', '#r_ip_error_text', isValidIPv4, 'IP inválida. Ingresa un formato IPv4 válido (ej. 192.168.10.45).');
    const vlanOk = validarCampoRedIndividual('#r_vlan', '#r_vlan_error', '#r_vlan_error_text', isValidVLAN, 'VLAN inválida. Debe ser un número entero entre 1 y 4094.');
    const puertoOk = validarCampoRedIndividual('#r_puerto', '#r_puerto_error', '#r_puerto_error_text', isValidPuerto, 'Puerto inválido. Ejemplos válidos: Gi1/0/24, Fa0/1, 24, Puerto 12 o Jack A-05.');

    if (!ipOk) { $('#r_ip')?.focus(); return false; }
    if (!vlanOk) { $('#r_vlan')?.focus(); return false; }
    if (!puertoOk) { $('#r_puerto')?.focus(); return false; }

    return true;
}


function isValidDescripcionRiesgo(desc) {
    const str = String(desc || '').trim();
    if (!str) return false;
    if (str.length < 8 || str.length > 400) return false;
    if (/^\d+$/.test(str)) return false; // Rechazar solo números como 9821709164893712642376
    if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]{3,}/.test(str)) return false; // Requiere letras reales
    return true;
}

function isValidInsumos(insumos) {
    const str = String(insumos || '').trim();
    if (!str) return true; // Insumos es opcional
    const items = str.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) return false;
    if (items.length > 15) return false;
    for (const it of items) {
        if (it.length < 2 || it.length > 60) return false;
        if (/^\d+$/.test(it)) return false; // No puede ser solo un número
        if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(it)) return false; // Debe tener letras
    }
    return true;
}

function isValidEstudiantes(val) {
    const str = String(val ?? '').trim();
    if (!str) return true; // Opcional
    if (!/^\d+$/.test(str)) return false;
    const n = Number(str);
    return Number.isInteger(n) && n >= 0 && n <= 5000;
}

function validarCamposInfra() {
    const cat = new FormData(form).get('categoria');
    if (cat !== 'infra') return true;

    let valid = true;
    let primerInvalido = null;

    // 1. Tipo de daño
    const danio = $('#i_danio');
    const danioErr = $('#i_danio_error');
    if (danio) {
        if (!danio.value.trim()) {
            valid = false;
            if (!primerInvalido) primerInvalido = danio;
            danio.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            if (danioErr) danioErr.classList.remove('hidden');
        } else {
            danio.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            if (danioErr) danioErr.classList.add('hidden');
        }
    }

    // 2. Nivel de riesgo
    const riesgo = $('#i_riesgo');
    const riesgoErr = $('#i_riesgo_error');
    if (riesgo) {
        if (!riesgo.value.trim()) {
            valid = false;
            if (!primerInvalido) primerInvalido = riesgo;
            riesgo.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            if (riesgoErr) riesgoErr.classList.remove('hidden');
        } else {
            riesgo.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            if (riesgoErr) riesgoErr.classList.add('hidden');
        }
    }

    // 3. Descripción del riesgo
    const desc = $('#i_desc');
    const descErr = $('#i_desc_error');
    const descErrText = $('#i_desc_error_text');
    if (desc) {
        const val = desc.value.trim();
        if (!isValidDescripcionRiesgo(val)) {
            valid = false;
            if (!primerInvalido) primerInvalido = desc;
            desc.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            if (descErr) {
                if (descErrText) descErrText.textContent = 'Describe el riesgo en al menos 8 caracteres (evita solo números como 12345 o símbolos).';
                descErr.classList.remove('hidden');
            }
        } else {
            desc.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            if (descErr) descErr.classList.add('hidden');
        }
    }

    // 4. Insumos requeridos
    const insumos = $('#i_insumos');
    const insumosErr = $('#i_insumos_error');
    const insumosErrText = $('#i_insumos_error_text');
    if (insumos) {
        const val = insumos.value.trim();
        if (val && !isValidInsumos(val)) {
            valid = false;
            if (!primerInvalido) primerInvalido = insumos;
            insumos.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            if (insumosErr) {
                if (insumosErrText) insumosErrText.textContent = 'Ingresa materiales válidos separados por coma (ej. impermeabilizante, lona; no solo números).';
                insumosErr.classList.remove('hidden');
            }
        } else {
            insumos.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            if (insumosErr) insumosErr.classList.add('hidden');
        }
    }

    if (!valid && primerInvalido) primerInvalido.focus();
    return valid;
}

function validarCamposAcademico() {
    const cat = new FormData(form).get('categoria');
    if (cat !== 'academico') return true;

    let valid = true;
    let primerInvalido = null;

    const plat = $('#a_plataforma');
    const platErr = $('#a_plataforma_error');
    if (plat) {
        if (!plat.value.trim()) {
            valid = false;
            if (!primerInvalido) primerInvalido = plat;
            plat.classList.add('border-red-500', 'ring-2', 'ring-red-200');
            if (platErr) platErr.classList.remove('hidden');
        } else {
            plat.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            if (platErr) platErr.classList.add('hidden');
        }
    }

    const est = $('#a_estudiantes');
    const estErr = $('#a_estudiantes_error');
    const estErrText = $('#a_estudiantes_error_text');
    if (est) {
        const val = est.value.trim();
        if (val) {
            if (/^-/.test(val)) {
                valid = false;
                if (!primerInvalido) primerInvalido = est;
                est.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                if (estErr) {
                    if (estErrText) estErrText.textContent = 'El número de estudiantes no puede ser negativo.';
                    estErr.classList.remove('hidden');
                }
            } else if (!/^\d+$/.test(val)) {
                valid = false;
                if (!primerInvalido) primerInvalido = est;
                est.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                if (estErr) {
                    if (estErrText) estErrText.textContent = 'Debe ser un número entero entre 0 y 5000.';
                    estErr.classList.remove('hidden');
                }
            } else {
                const num = Number(val);
                if (num > 5000) {
                    valid = false;
                    if (!primerInvalido) primerInvalido = est;
                    est.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                    if (estErr) {
                        if (estErrText) estErrText.textContent = `No puedes ingresar más de 5000 estudiantes (has ingresado ${num}).`;
                        estErr.classList.remove('hidden');
                    }
                } else {
                    est.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                    if (estErr) estErr.classList.add('hidden');
                }
            }
        } else {
            est.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            if (estErr) estErr.classList.add('hidden');
        }
    }

    if (!valid && primerInvalido) primerInvalido.focus();
    return valid;
}

function setupPolymorphicLiveValidation() {
    // Redes
    const rIp = $('#r_ip');
    if (rIp) {
        const vIp = () => validarCampoRedIndividual('#r_ip', '#r_ip_error', '#r_ip_error_text', isValidIPv4, 'IP inválida. Ingresa un formato IPv4 válido (ej. 192.168.10.45).');
        rIp.addEventListener('input', vIp);
        rIp.addEventListener('blur', vIp);
    }
    const rVlan = $('#r_vlan');
    if (rVlan) {
        const vVlan = () => validarCampoRedIndividual('#r_vlan', '#r_vlan_error', '#r_vlan_error_text', isValidVLAN, 'VLAN inválida. Debe ser un número entero entre 1 y 4094.');
        rVlan.addEventListener('input', vVlan);
        rVlan.addEventListener('blur', vVlan);
    }
    const rPuerto = $('#r_puerto');
    if (rPuerto) {
        const vPuerto = () => validarCampoRedIndividual('#r_puerto', '#r_puerto_error', '#r_puerto_error_text', isValidPuerto, 'Puerto inválido. Ejemplos válidos: Gi1/0/24, Fa0/1, 24, Puerto 12 o Jack A-05.');
        rPuerto.addEventListener('input', vPuerto);
        rPuerto.addEventListener('blur', vPuerto);
    }

    // Infraestructura
    const iDanio = $('#i_danio');
    if (iDanio) {
        iDanio.addEventListener('change', () => {
            if (iDanio.value.trim()) {
                iDanio.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                $('#i_danio_error')?.classList.add('hidden');
            }
        });
    }
    const iRiesgo = $('#i_riesgo');
    if (iRiesgo) {
        iRiesgo.addEventListener('change', () => {
            if (iRiesgo.value.trim()) {
                iRiesgo.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                $('#i_riesgo_error')?.classList.add('hidden');
            }
        });
    }
    const iDesc = $('#i_desc');
    if (iDesc) {
        const valDesc = () => {
            const val = iDesc.value.trim();
            if (!val || isValidDescripcionRiesgo(val)) {
                iDesc.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                $('#i_desc_error')?.classList.add('hidden');
            } else {
                iDesc.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                const errTxt = $('#i_desc_error_text');
                if (errTxt) errTxt.textContent = 'Describe el riesgo en al menos 8 caracteres (evita solo números o símbolos).';
                $('#i_desc_error')?.classList.remove('hidden');
            }
        };
        iDesc.addEventListener('input', valDesc);
        iDesc.addEventListener('blur', valDesc);
    }
    const iInsumos = $('#i_insumos');
    if (iInsumos) {
        const valInsumos = () => {
            const val = iInsumos.value.trim();
            if (!val || isValidInsumos(val)) {
                iInsumos.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                $('#i_insumos_error')?.classList.add('hidden');
            } else {
                iInsumos.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                const errTxt = $('#i_insumos_error_text');
                if (errTxt) errTxt.textContent = 'Ingresa materiales válidos separados por coma (ej. impermeabilizante, lona; no solo números).';
                $('#i_insumos_error')?.classList.remove('hidden');
            }
        };
        iInsumos.addEventListener('input', valInsumos);
        iInsumos.addEventListener('blur', valInsumos);
    }

    // Académico
    const aPlat = $('#a_plataforma');
    if (aPlat) {
        aPlat.addEventListener('change', () => {
            if (aPlat.value.trim()) {
                aPlat.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                $('#a_plataforma_error')?.classList.add('hidden');
            }
        });
    }

    const aEst = $('#a_estudiantes');
    if (aEst) {
        const valEst = () => {
            const val = aEst.value.trim();
            const errEl = $('#a_estudiantes_error');
            const errTxt = $('#a_estudiantes_error_text');

            if (!val) {
                aEst.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                if (errEl) errEl.classList.add('hidden');
                return true;
            }

            if (/^-/.test(val)) {
                aEst.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                if (errTxt) errTxt.textContent = 'El número de estudiantes no puede ser negativo.';
                if (errEl) errEl.classList.remove('hidden');
                return false;
            }

            if (!/^\d+$/.test(val)) {
                aEst.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                if (errTxt) errTxt.textContent = 'Debe ser un número entero entre 0 y 5000.';
                if (errEl) errEl.classList.remove('hidden');
                return false;
            }

            const num = Number(val);
            if (num > 5000) {
                aEst.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                if (errTxt) errTxt.textContent = `No puedes ingresar más de 5000 estudiantes (has ingresado ${num}).`;
                if (errEl) errEl.classList.remove('hidden');
                return false;
            }

            // Válido
            aEst.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
            if (errEl) errEl.classList.add('hidden');
            return true;
        };

        aEst.addEventListener('input', valEst);
        aEst.addEventListener('change', valEst);
        aEst.addEventListener('blur', valEst);
    }
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
            updateEvidenciasCounter();
            switchCategory(null);
            $('.field', form).forEach((f) => f.classList.remove('border-red-400', 'border-red-500', 'ring-2', 'ring-red-200'));
            $('#r_ip_error')?.classList.add('hidden');
            $('#r_vlan_error')?.classList.add('hidden');
            $('#r_puerto_error')?.classList.add('hidden');
            $('#i_danio_error')?.classList.add('hidden');
            $('#i_riesgo_error')?.classList.add('hidden');
            $('#i_desc_error')?.classList.add('hidden');
            $('#i_insumos_error')?.classList.add('hidden');
            $('#a_plataforma_error')?.classList.add('hidden');
            $('#a_estudiantes_error')?.classList.add('hidden');
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

        // Validar datos específicos por categoría polimórfica
        if (cat === 'redes' && !validarCamposRedes()) {
            toast('Por favor corrige los datos de red marcados en rojo antes de enviar.', 'warn');
            return;
        }
        if (cat === 'infra' && !validarCamposInfra()) {
            toast('Por favor corrige los datos de infraestructura marcados en rojo antes de enviar.', 'warn');
            return;
        }
        if (cat === 'academico' && !validarCamposAcademico()) {
            toast('Por favor corrige los datos de la categoría Académico marcados en rojo antes de enviar.', 'warn');
            return;
        }


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

            // Adjuntar todas las evidencias seleccionadas (hasta 5)
            if (uploaded.length > 0) {
                uploaded.slice(0, 5).forEach((item) => {
                    if (item.file) {
                        formDataToSend.append('evidencias', item.file);
                    }
                });
            }

            const res = await apiCrearIncidencia(formDataToSend);

            toast(`Incidencia <b>${res.codigo}</b> registrada en MongoDB Atlas con éxito.`, 'ok');
            if (res.total_evidencias > 0) {
                toast(`Se subieron <b>${res.total_evidencias} evidencia(s)</b> a Cloudinary.`, 'info');
            } else if (res.url_evidencia) {
                toast(`Evidencia subida a Cloudinary: <a href="${res.url_evidencia}" target="_blank" class="underline text-xs">Ver archivo</a>`, 'info');
            }

            form.reset();
            uploaded = [];
            renderFiles();
            updateEvidenciasCounter();
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

// ---------- Evidencias y Carga a Cloudinary (Límite estricto de 5 archivos y 10 MB) ----------
const MAX_ARCHIVOS = 5;
const MAX_TAMANO_BYTES = 10 * 1024 * 1024; // 10 MB
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];

const fileInput = $('#evidencias');
const dropZone = $('#dropZone');

function updateEvidenciasCounter() {
    const counter = $('#evidenciasCounter');
    if (!counter) return;
    const count = uploaded.length;
    counter.textContent = `${count} / ${MAX_ARCHIVOS} archivos`;
    if (count >= MAX_ARCHIVOS) {
        counter.className = 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800';
    } else {
        counter.className = 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600';
    }
}

function addFiles(files) {
    if (!files || files.length === 0) return;

    if (uploaded.length >= MAX_ARCHIVOS) {
        toast(`Ya alcanzaste el límite máximo de ${MAX_ARCHIVOS} archivos de evidencia.`, 'warn');
        return;
    }

    let agregados = 0;
    let omitidosPorLimite = 0;

    for (const f of files) {
        if (uploaded.length >= MAX_ARCHIVOS) {
            omitidosPorLimite++;
            continue;
        }

        // 1. Validar tipo de archivo
        const mime = (f.type || '').toLowerCase();
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const esPermitido = TIPOS_PERMITIDOS.includes(mime) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4'].includes(ext);

        if (!esPermitido) {
            toast(`El archivo "${esc(f.name)}" no tiene un formato válido (solo JPG, PNG, WebP o MP4).`, 'warn');
            continue;
        }

        // 2. Validar tamaño (máx 10 MB)
        if (f.size > MAX_TAMANO_BYTES) {
            toast(`El archivo "${esc(f.name)}" supera el límite de 10 MB (${(f.size / (1024 * 1024)).toFixed(1)} MB).`, 'warn');
            continue;
        }

        // 3. Evitar duplicados exactos
        if (uploaded.some((item) => item.name === f.name && item.size === f.size)) {
            toast(`El archivo "${esc(f.name)}" ya fue agregado previamente.`, 'info');
            continue;
        }

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
        agregados++;
    }

    if (omitidosPorLimite > 0) {
        toast(`Se alcanzó el límite de ${MAX_ARCHIVOS} evidencias. Se omitieron ${omitidosPorLimite} archivo(s) excedente(s).`, 'warn');
    }

    renderFiles();
    updateEvidenciasCounter();
    updatePreview();
}

function renderFiles() {
    const listEl = $('#fileList');
    if (!listEl) return;
    listEl.innerHTML = uploaded.map((f) => {
        const esImagen = f.file && f.file.type && f.file.type.startsWith('image/');
        const tamanoFormateado = f.size > 1024 * 1024 
            ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` 
            : `${Math.round(f.size / 1024)} KB`;

        return `
    <li class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
      ${esImagen ? `
        <img src="${f.url}" alt="${esc(f.name)}" class="w-10 h-10 rounded-lg object-cover border border-gray-300 shrink-0" />
      ` : `
        <span class="w-10 h-10 rounded-lg grid place-items-center shrink-0 ${f.done ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}">
          <i class="fa-solid ${f.type === 'video' ? 'fa-film' : 'fa-image'}"></i>
        </span>
      `}
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-center text-xs">
          <span class="font-semibold text-gray-700 truncate mr-2" title="${esc(f.name)}">${esc(f.name)}</span>
          <span class="text-green-700 font-medium whitespace-nowrap"><i class="fa-solid fa-cloud-arrow-up"></i> ${tamanoFormateado}</span>
        </div>
        <div class="mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden"><div class="h-full bg-green-600 w-full"></div></div>
      </div>
      <button type="button" data-rm="${f.id}" class="text-gray-400 hover:text-red-500 p-1" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>
    </li>`;
    }).join('');
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => { addFiles(e.target.files); fileInput.value = ''; });
    ['dragover', 'dragenter'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('border-green-600', 'bg-green-50'); }));
    ['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('border-green-600', 'bg-green-50'); }));
    dropZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
    $('#fileList').addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]');
        if (b) { 
            uploaded = uploaded.filter((f) => f.id !== b.dataset.rm); 
            renderFiles(); 
            updateEvidenciasCounter();
            updatePreview(); 
        }
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
            ? `<a href="${t.evidencias[0].url_storage || '#'}" target="_blank" onclick="event.stopPropagation()" class="text-xs text-green-700 hover:underline flex items-center gap-1"><i class="fa-solid fa-paperclip"></i> ${t.evidencias.length > 1 ? `Evidencias (${t.evidencias.length})` : 'Evidencia'}</a>`
            : '';
        return `
    <div class="px-6 py-5 hover:bg-gray-50 transition cursor-pointer" data-id="${t.id}">
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

// Inicializar validación en tiempo real de campos polimórficos
setupPolymorphicLiveValidation();
