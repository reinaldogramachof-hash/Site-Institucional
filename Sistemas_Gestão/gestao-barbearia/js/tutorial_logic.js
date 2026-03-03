
// ==========================================
// LÓGICA DO MANUAL (TUTORIAL)
// ==========================================

const tutorialSections = [
    'instalacao',
    'primeiro-cadastro',
    'agendamentos',
    'relatorios',
    'backup',
    'duvidas',
    'checklist'
];

function initTutorial() {
    updateTutorialProgress();
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function markSectionComplete(id) {
    // Recuperar estado atual
    let progress = JSON.parse(localStorage.getItem('tutorial_progress') || '[]');

    // Adicionar se não existir
    if (!progress.includes(id)) {
        progress.push(id);
        localStorage.setItem('tutorial_progress', JSON.stringify(progress));

        // Feedback visual
        showNotification('Etapa concluída com sucesso!', 'success');

        // Atualizar UI
        updateTutorialProgress();
    } else {
        showNotification('Esta etapa já foi concluída!', 'info');
    }
}

function updateTutorialProgress() {
    const progress = JSON.parse(localStorage.getItem('tutorial_progress') || '[]');
    const total = tutorialSections.length;
    const completed = progress.length;
    const percent = Math.round((completed / total) * 100);

    // Atualizar barra
    const bar = document.getElementById('tutorial-progress');
    if (bar) bar.style.width = `${percent}%`;

    // Atualizar texto
    const text = document.getElementById('completed-steps');
    if (text) text.innerText = `${completed}/${total} etapas`;

    // Atualizar botões das seções (opcional: mudar cor)
    tutorialSections.forEach(section => {
        const btn = document.querySelector(`button[onclick="scrollToSection('${section}')"]`);
        if (btn) {
            if (progress.includes(section)) {
                btn.classList.add('bg-green-100', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-400', 'border-green-200', 'dark:border-green-800/50');
                btn.classList.remove('hover:bg-gray-50', 'dark:hover:bg-slate-800', 'border-gray-200', 'dark:border-white/10');
                // Adicionar check se não tiver
                if (!btn.innerHTML.includes('✓')) {
                    btn.innerHTML = `✓ ${btn.innerText.replace(/^\d+\.\s/, '')}`; // Remove número antigo se quiser, ou só add check
                }
            }
        }
    });

    // Validar checklist (se houver lógica específica para ele)
    if (typeof updateChecklist === 'function') {
        // updateChecklist(); // Já deve ser chamado independentemente
    }
}

// Inicializar tutorial ao carregar (chamar no final do init)