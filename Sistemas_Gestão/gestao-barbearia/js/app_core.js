
// ESTADO GLOBAL
const DB_KEY = 'brand_barber_pro_v2';
const defaultDB = {
    appointments: [],
    team: [
        {
            id: 'adm',
            name: 'Administrador (Dono)',
            commission: 0,
            contract: 'CLT',
            phone: '',
            startDate: '',
            notes: 'Acesso total'
        }
    ],
    services: [
        { id: 's1', name: 'Corte Degradê', price: 40.00 },
        { id: 's2', name: 'Corte Social', price: 35.00 },
        { id: 's3', name: 'Barba Completa', price: 30.00 },
        { id: 's4', name: 'Combo Corte + Barba', price: 60.00 },
        { id: 's5', name: 'Pezinho / Acabamento', price: 15.00 },
        { id: 's6', name: 'Sobrancelha', price: 20.00 },
        { id: 's7', name: 'Platinado / Nevou', price: 120.00 },
        { id: 's8', name: 'Relaxamento', price: 80.00 },
        { id: 's9', name: 'Hidratação Capilar', price: 45.00 },
        { id: 's10', name: 'Luzes Masculinas', price: 150.00 },
        { id: 's11', name: 'Coloração', price: 70.00 },
        { id: 's12', name: 'Corte Infantil', price: 30.00 },
        { id: 's13', name: 'Tratamento para Barba', price: 50.00 }
    ],
    clients: [],
    transactions: [],
    settings: {
        businessName: '',
        businessHours: '09:00 às 19:00',
        theme: 'blue',
        termsAccepted: false,
        termsAcceptedAt: null
    },
    tutorial: {
        completedSteps: [],
        checklistState: {}
    },
    inventory: [],
    stockMovements: []
};
let db = JSON.parse(localStorage.getItem(DB_KEY)) || defaultDB;
// Migração: garantir que campos novos existam em bancos antigos
if (!db.inventory) db.inventory = [];
if (!db.stockMovements) db.stockMovements = [];
// UTILITÁRIOS
const sanitizeHTML = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
const save = () => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    updateDataStatus();
};
const fmtMoney = (v) => {
    return v.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
const fmtDate = (d) => {
    if (!d) return '--/--/--';
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR');
};
const fmtDateInput = (d) => {
    return new Date(d).toISOString().split('T')[0];
};
const getID = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};
const calculatePercentage = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(1);
};
// INICIALIZAÇÃO
async function init() {
    try {
        lucide.createIcons();

        // Configurar datas padrão
        const today = new Date().toISOString().split('T')[0];
        const firstDay = new Date();
        firstDay.setDate(1);
        const firstDayStr = firstDay.toISOString().split('T')[0];

        // Configurar inputs de data
        const dateIds = ['ap-date', 'agenda-date', 'exp-date', 'rep-start', 'rep-end', 'filter-start', 'filter-end'];
        dateIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id.includes('start')) el.value = firstDayStr;
                else el.value = today;
            }
        });

        // Configurar business info
        if (document.getElementById('biz-name')) document.getElementById('biz-name').value = db.settings.businessName || '';
        if (document.getElementById('biz-owner')) document.getElementById('biz-owner').value = db.settings.businessOwner || '';
        if (document.getElementById('biz-doc')) document.getElementById('biz-doc').value = db.settings.businessDoc || '';
        if (document.getElementById('biz-hours')) document.getElementById('biz-hours').value = db.settings.businessHours || '';

        // Renderizar dados iniciais
        renderDashboard();
        updateDataStatus();
        if (typeof updateTermsVisuals === 'function') updateTermsVisuals();

        // Configurar periodicidade para salvar
        setInterval(save, 30000); // Salva a cada 30 segundos

        // Inicializar visual
        router('dashboard');

        // Inicializar Tutorial
        if (typeof initTutorial === 'function') initTutorial();

        // Lógica de Auditoria e Airlock
        checkAirlock();

    } catch (criticalError) {
        console.error('Erro crítico na inicialização:', criticalError);
        checkAirlock();
    }
}

// ==========================================
// LÓGICA DE SEGURANÇA E ATIVAÇÃO
// ==========================================
async function checkAirlock() {
    const key = localStorage.getItem('plena_license');
    const receiptConfirmed = localStorage.getItem('ml_receipt_confirmed');

    if (!key) {
        document.getElementById('view-login').style.display = 'flex';
        document.getElementById('app-main-content').style.display = 'none';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    if (!receiptConfirmed) {
        document.getElementById('view-login').style.display = 'none';
        document.getElementById('app-main-content').style.display = 'none';
        const modal = document.getElementById('welcome-receipt-modal');
        if (modal) modal.classList.remove('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    unlockSystem();
}

function unlockSystem() {
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('app-main-content').style.display = 'block';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function activateSystem() {
    const email = document.getElementById('activation-email').value.trim();
    const key = document.getElementById('activation-key').value.trim();
    const btn = document.getElementById('btn-activate');

    if (!email || !key) {
        alert('Por favor, preencha todos os campos.');
        return;
    }

    // Gera um ID único para este navegador se não existir
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('device_id', deviceId);
    }

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Verificando...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        // V11 - Roteamento Explícito por URL
        const response = await fetch('../api_licenca_ml.php?action=activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                license_key: key,
                email: email,
                device_id: deviceId
            })
        });

        const data = await response.json();

        if (data.status === 'success' && data.valid === true) {
            // 1. Salva credenciais
            localStorage.setItem('plena_license', key);
            localStorage.setItem('ml_license_email', email);

            // 2. Destrava a UI (FIM DA TELA AZUL)
            document.getElementById('view-login').style.display = 'none';
            const appContent = document.getElementById('app-main-content');
            if (appContent) {
                appContent.style.display = 'block';
                appContent.classList.remove('hidden');
            }

            // 3. Verifica Recibo (Sem travar o app)
            if (!localStorage.getItem('ml_receipt_confirmed')) {
                setTimeout(() => {
                    // Mostra o modal de recibo 1 segundo DEPOIS do app abrir
                    const receiptModal = document.getElementById('welcome-receipt-modal');
                    if (receiptModal) receiptModal.classList.remove('hidden');
                }, 1000);
            }

            if (typeof lucide !== 'undefined') lucide.createIcons();
            alert('Sistema Liberado! Bem-vindo(a) ' + (data.client || ''));

        } else {
            alert('Erro: ' + (data.message || 'Falha na validação.'));
        }
    } catch (e) {
        console.error('Falha na ativação:', e);
        alert('Erro de conexão. Tente novamente.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Desbloquear Acesso</span><i data-lucide="unlock" class="w-5 h-5"></i>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function confirmReceipt() {
    const btn = document.getElementById('btn-confirm-receipt');
    if (btn) {
        btn.innerText = "Registrando...";
        btn.disabled = true;
    }

    const key = localStorage.getItem('plena_license'); // Pega a chave salva no login

    try {
        // Envia JSON, igual ao activate
        const response = await fetch('../api_licenca_ml.php?action=confirm_receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // Cabeçalho Importante
            body: JSON.stringify({
                license_key: key,
                legal_agree: true
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            localStorage.setItem('ml_receipt_confirmed', 'true');
            const modal = document.getElementById('welcome-receipt-modal');
            if (modal) modal.classList.add('hidden');
            alert("Recebimento Confirmado! Bom trabalho.");
            unlockSystem(); // Libera o app
        } else {
            console.error("Erro Recibo:", data);
            alert("Atenção: Não foi possível registrar o recibo automaticamente.\nErro: " + (data.message || "Falha de comunicação."));
            if (btn) {
                btn.disabled = false;
                btn.innerText = "Tentar Novamente";
            }
        }
    } catch (e) {
        alert("Erro de conexão.");
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Confirmar Recebimento";
        }
    }
}
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
function updateDateDisplay() {
    const update = () => {
        const now = new Date();
        const optsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const dateStr = now.toLocaleDateString('pt-BR', optsDate);
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const el = document.getElementById('current-date');
        if (el) el.textContent = `${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} • ${timeStr}`;
    };
    update(); // Initial call
    setInterval(update, 1000); // Update every second
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
        if (typeof showNotification === 'function') {
            showNotification('Etapa concluída com sucesso!', 'success');
        } else {
            alert('Etapa concluída!');
        }
        // Atualizar UI
        updateTutorialProgress();
    } else {
        if (typeof showNotification === 'function') {
            showNotification('Esta etapa já foi concluída!', 'info');
        }
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
    // Atualizar visual dos botões
    tutorialSections.forEach(section => {
        const btn = document.querySelector(`button[onclick="scrollToSection('${section}')"]`);
        if (btn) {
            if (progress.includes(section)) {
                btn.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
                btn.classList.remove('hover:bg-gray-50', 'border-gray-200');
            }
        }
    });
}
// ==========================================
// PWA INSTALLATION LOGIC
// ==========================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can add to home screen
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.classList.add('flex'); // Ensure flex display
    }
});
function installApp() {
    // Hide the app provided install promotion
    const installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.classList.add('hidden');
        installBtn.classList.remove('flex');
    }
    // Show the install prompt
    if (deferredPrompt) {
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                // Usuário aceitou a instalação
            } else {
                // Usuário recusou a instalação
            }
            deferredPrompt = null;
        });
    }
}
window.addEventListener('appinstalled', (evt) => {
    // App instalado com sucesso
});
// ROTEAMENTO E NAVEGAÇÃO
function router(view) {
    // Esconder todas as views
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hide'));
    // Remover classe active de todos os nav items
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-white/10', 'text-white', 'active-nav');
        el.classList.add('text-slate-400');
    });
    // Mostrar view selecionada
    const viewElement = document.getElementById(`view-${view}`);
    if (viewElement) {
        viewElement.classList.remove('hide');
        viewElement.classList.add('fade-in');
    }
    // Ativar nav item selecionado
    const navElement = document.getElementById(`nav-${view}`);
    if (navElement) {
        navElement.classList.add('active-nav');
        navElement.classList.remove('text-slate-400');
    }
    // Atualizar título da página
    const titles = {
        dashboard: 'Agenda',
        team: 'Barbeiros',
        services: 'Serviços',
        inventory: 'Estoque',
        finance: 'Financeiro',
        clients: 'Clientes',
        reports: 'Relatórios',
        settings: 'Configurações',
        instructions: 'Manual de Uso',
        about: 'Sobre'
    };
    document.getElementById('page-title').innerText = titles[view] || 'Gestão Barbearia';
    // Fechar sidebar no mobile
    if (window.innerWidth < 1024) {
        toggleSidebar();
    }
    // Renderizar dados específicos da view
    if (view === 'dashboard') {
        renderDashboard();
    } else if (view === 'team') {
        renderTeam();
    } else if (view === 'services') {
        renderServices();
    } else if (view === 'inventory') {
        renderInventory();
    } else if (view === 'finance') {
        renderFinance();
    } else if (view === 'clients') {
        renderClients();
    }
}
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('hidden');
    // Bloquear scroll do body quando sidebar aberta
    document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
}
// DASHBOARD
function renderDashboard() {
    const date = document.getElementById('agenda-date').value;
    const todayAppts = db.appointments
        .filter(a => a.date === date)
        .sort((a, b) => a.time.localeCompare(b.time));
    // Calcular estatísticas
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTrans = db.transactions.filter(t => t.date === todayStr);
    const incomeToday = todayTrans
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenseToday = todayTrans
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    const commissionPending = db.transactions
        .filter(t => t.type === 'income' && !t.commissionPaid)
        .reduce((sum, t) => sum + (t.commission || 0), 0);
    // Atualizar KPI cards
    document.getElementById('dash-appt-today').innerText = db.appointments
        .filter(a => a.date === todayStr && a.status === 'pending').length;
    document.getElementById('dash-rev-today').innerText = fmtMoney(incomeToday);
    document.getElementById('dash-comm-pending').innerText = fmtMoney(commissionPending);
    // Calcular crescimento vs ontem
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yesterdayIncome = db.transactions
        .filter(t => t.date === yesterdayStr && t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const growth = calculatePercentage(incomeToday, yesterdayIncome);
    document.getElementById('rev-growth').innerText = `${growth}%`;
    // Renderizar agenda
    const agendaList = document.getElementById('agenda-list');
    if (todayAppts.length === 0) {
        agendaList.innerHTML = `
                    <div class="text-center py-8">
                        <i data-lucide="calendar-x" class="w-12 h-12 mx-auto mb-4 text-slate-300"></i>
                        <p class="text-slate-400">Nenhum agendamento para esta data</p>
                    </div>
                `;
    } else {
        agendaList.innerHTML = todayAppts.map(appt => `
                    <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center ${appt.status === 'canceled' ? 'opacity-60' : ''}">
                        <div class="flex items-center gap-4">
                            <div class="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border dark:border-white/10 text-center min-w-[70px]">
                                <span class="block font-bold text-lg text-slate-800 dark:text-white">${appt.time}</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-900 dark:text-white">${sanitizeHTML(appt.client)}</h4>
                                <p class="text-xs text-slate-500 dark:text-slate-400">
                                    ${sanitizeHTML(appt.serviceName)} com <strong>${sanitizeHTML(appt.proName)}</strong>
                                </p>
                                <span class="inline-block mt-1 px-2 py-1 text-xs rounded-full ${appt.status === 'pending' ? 'badge-pending' : appt.status === 'done' ? 'badge-done' : 'badge-canceled'}">
                                    ${appt.status === 'pending' ? 'Pendente' : appt.status === 'done' ? 'Concluído' : 'Cancelado'}
                                </span>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            ${appt.status === 'pending' ? `
                                <button onclick="cancelAppt('${appt.id}')" class="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Cancelar">
                                    <i data-lucide="x" class="w-5 h-5"></i>
                                </button>
                                <button onclick="finishAppt('${appt.id}')" class="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" title="Finalizar">
                                    <i data-lucide="check" class="w-5 h-5"></i>
                                </button>
                            ` : ''}
                            ${appt.status === 'done' ? `
                                <span class="text-green-600 text-sm font-bold">${fmtMoney(appt.price)}</span>
                            ` : ''}
                        </div>
                    </div>
                `).join('');
    }
    // Renderizar próximos agendamentos
    const upcoming = db.appointments
        .filter(a => a.status === 'pending' && a.date >= todayStr)
        .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
        .slice(0, 3);
    const upcomingList = document.getElementById('upcoming-appts');
    if (upcoming.length === 0) {
        upcomingList.innerHTML = '<p class="text-center text-slate-400 py-4">Nenhum agendamento futuro</p>';
    } else {
        upcomingList.innerHTML = upcoming.map(appt => `
                    <div class="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-white/5 transition-colors">
                        <div>
                            <p class="text-sm font-medium text-slate-800 dark:text-white">${sanitizeHTML(appt.client)}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400">${fmtDate(appt.date)} às ${appt.time}</p>
                        </div>
                        <span class="text-sm text-brand-blue font-bold">${sanitizeHTML(appt.serviceName)}</span>
                    </div>
                `).join('');
    }
    lucide.createIcons();
}
// TEAM MANAGEMENT
function renderTeam() {
    const list = document.getElementById('team-list');
    if (!list) return;

    if (db.team.length === 0) {
        list.innerHTML = `
            <div class="col-span-full text-center py-8">
                <i data-lucide="users" class="w-12 h-12 mx-auto mb-4 text-slate-300"></i>
                <p class="text-slate-400">Nenhum barbeiro cadastrado</p>
            </div>
        `;
        return;
    }

    list.innerHTML = db.team.map(t => {
        // Calculate stats
        const servicesCount = db.appointments.filter(a => a.proId === t.id && (a.status === 'done' || a.status === 'concluido')).length;

        const pendingCommissions = db.transactions
            .filter(tr => tr.proId === t.id && tr.type === 'income' && !tr.commissionPaid)
            .reduce((sum, tr) => sum + (tr.commission || 0), 0);

        const rawPhone = t.phone ? t.phone.replace(/\D/g, '') : '';
        const waLink = rawPhone ? `https://wa.me/55${rawPhone}` : null;

        return `
        <div class="bg-white dark:bg-barber-card p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col justify-between h-full card-hover">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <i data-lucide="user" class="w-6 h-6"></i>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider">
                            ${t.contract || 'PJ'}
                        </span>
                        <span class="text-[10px] font-bold text-brand-blue dark:text-brand-lightblue uppercase">Comissão: ${t.commission}%</span>
                    </div>
                </div>
                <h3 class="font-bold text-lg text-slate-800 dark:text-white mb-1">${sanitizeHTML(t.name)}</h3>
                ${t.startDate ? `<p class="text-[10px] text-slate-400 dark:text-slate-500 mb-4 flex items-center"><i data-lucide="calendar" class="w-3 h-3 mr-1"></i> Desde ${fmtDate(t.startDate)}</p>` : '<div class="mb-4"></div>'}
                
                <div class="space-y-2 mt-4">
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-500 dark:text-slate-400">Serviços realizados:</span>
                        <span class="font-bold text-slate-800 dark:text-slate-200">${servicesCount}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-500 dark:text-slate-400">Comissões pendentes:</span>
                        <span class="font-bold ${pendingCommissions > 0 ? 'text-brand-blue dark:text-brand-lightblue' : 'text-slate-400 dark:text-slate-600'}">${fmtMoney(pendingCommissions)}</span>
                    </div>
                </div>
            </div>

            <div class="mt-6 pt-4 border-t border-slate-50 dark:border-white/5 flex gap-2">
                <button onclick="payCommission('${t.id}')" 
                    class="flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${pendingCommissions > 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-brand-lightblue hover:bg-blue-100 dark:hover:bg-blue-900/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'}"
                    ${pendingCommissions === 0 ? 'disabled' : ''}>
                    Pagar Comissão
                </button>
                <div class="flex gap-1">
                    ${waLink ? `
                        <a href="${waLink}" target="_blank" class="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition-colors" title="WhatsApp">
                            <i data-lucide="message-circle" class="w-5 h-5"></i>
                        </a>
                    ` : ''}
                    <button onclick="editTeam('${t.id}')" class="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Editar">
                        <i data-lucide="edit-2" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    lucide.createIcons();
}
// SERVICES MANAGEMENT (Atualizados para universo masculino)
function renderServices() {
    const container = document.getElementById('services-list');
    if (db.services.length === 0) {
        container.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <i data-lucide="scissors" class="w-12 h-12 mx-auto mb-4 text-slate-300"></i>
                        <p class="text-slate-400">Nenhum serviço cadastrado</p>
                    </div>
                `;
        return;
    }
    container.innerHTML = db.services.map(service => {
        const serviceCount = db.transactions
            .filter(t => t.serviceId === service.id)
            .length;
        return `
                    <div class="bg-white dark:bg-barber-card p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm flex justify-between items-center card-hover transition-all">
                        <div>
                            <span class="font-bold text-slate-800 dark:text-white">${service.name}</span>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${serviceCount} realizados</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-brand-blue dark:text-brand-lightblue">${fmtMoney(service.price)}</span>
                            <button onclick="editService('${service.id}')" 
                                    class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <i data-lucide="edit" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `;
    }).join('');
    lucide.createIcons();
}
// FINANCE MANAGEMENT
function renderFinance() {
    const term = document.getElementById('search-term').value.toLowerCase();
    const filter = document.getElementById('filter-type').value;
    const start = document.getElementById('filter-start').value;
    const end = document.getElementById('filter-end').value;
    // Filtrar transações
    let filtered = db.transactions.filter(t => {
        const matchesTerm = t.description.toLowerCase().includes(term) ||
            (t.proName && t.proName.toLowerCase().includes(term));
        const matchesType = filter === 'all' || t.type === filter;
        const matchesDate = (!start || t.date >= start) && (!end || t.date <= end);
        return matchesTerm && matchesType && matchesDate;
    });
    // Ordenar por data (mais recente primeiro)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    // Atualizar estatísticas
    const monthTrans = db.transactions.filter(t => {
        const today = new Date();
        const transDate = new Date(t.date);
        return transDate.getMonth() === today.getMonth() &&
            transDate.getFullYear() === today.getFullYear();
    });
    const incomeMonth = monthTrans
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenseMonth = monthTrans
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    const commissionMonth = monthTrans
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.commission || 0), 0);
    document.getElementById('fin-income').textContent = fmtMoney(incomeMonth);
    document.getElementById('fin-expense').textContent = fmtMoney(expenseMonth);
    document.getElementById('fin-commission').textContent = fmtMoney(commissionMonth);
    // Atualizar tabela
    const tbody = document.getElementById('trans-list');
    const emptyMsg = document.getElementById('empty-msg');
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg.classList.add('hidden');
    tbody.innerHTML = filtered.map(t => {
        const isIncome = t.type === 'income';
        return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 group border-b border-slate-100 dark:border-white/5 transition-colors">
                        <td class="px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">${fmtDate(t.date)}</td>
                        <td class="px-6 py-4">
                            <div class="font-medium text-slate-800 dark:text-white">${sanitizeHTML(t.description)}</div>
                        ${t.category ? `<div class="text-xs text-slate-400 dark:text-slate-500">${sanitizeHTML(t.category)}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 dark:text-slate-300">${t.proName ? sanitizeHTML(t.proName) : '-'}</td>
                        <td class="px-6 py-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isIncome ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}">
                                ${isIncome ? 'Entrada' : 'Saída'}
                            </span>
                        </td>
                        <td class="px-6 py-4 text-right font-bold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                            ${isIncome ? '+' : '-'} ${fmtMoney(t.amount)}
                        </td>
                        <td class="px-6 py-4 text-right text-sm text-slate-500 dark:text-slate-400">
                            ${t.commission ? fmtMoney(t.commission) : '-'}
                        </td>
                        <td class="px-6 py-4 text-right">
                            <button onclick="editTransaction('${t.id}')" class="text-slate-400 hover:text-blue-600 dark:hover:text-brand-lightblue transition-colors">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                            </button>
                        </td>
                    </tr>
                `;
    }).join('');
    lucide.createIcons();
}


// CLIENTS MANAGEMENT
function renderClients() {
    const container = document.getElementById('clients-list');
    if (db.clients.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-slate-400 dark:text-slate-500">
                    <i data-lucide="user" class="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600"></i>
                    <p>Nenhum cliente cadastrado</p>
                </td>
            </tr>
        `;
        return;
    }
    container.innerHTML = db.clients.map(client => {
        const clientTrans = db.transactions
            .filter(t => t.clientId === client.id && t.type === 'income');
        const totalSpent = clientTrans.reduce((sum, t) => sum + t.amount, 0);
        const lastVisit = clientTrans.length > 0
            ? clientTrans.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
            : null;

        // WhatsApp Link Logic
        const rawPhone = client.phone ? client.phone.replace(/\D/g, '') : '';
        const waLink = rawPhone ? `https://wa.me/55${rawPhone}` : '#';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-white/5 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-slate-800 dark:text-white">${sanitizeHTML(client.name)}</div>
                    ${client.email ? `<div class="text-xs text-slate-400 dark:text-slate-500">${sanitizeHTML(client.email)}</div>` : ''}
                </td>
                <td class="px-6 py-4 text-slate-600 dark:text-slate-400">${client.phone ? sanitizeHTML(client.phone) : '-'}</td>
                <td class="px-6 py-4 text-slate-500 dark:text-slate-500">${lastVisit ? fmtDate(lastVisit) : 'Nunca'}</td>
                <td class="px-6 py-4 font-bold text-brand-blue dark:text-brand-lightblue">${fmtMoney(totalSpent)}</td>
                <td class="px-6 py-4 text-center">
                    <div class="flex justify-center gap-2">
                        <!-- WhatsApp Action -->
                        ${rawPhone ? `
                        <a href="${waLink}" target="_blank" class="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition-colors" title="Chamar no WhatsApp">
                            <i data-lucide="message-circle" class="w-4 h-4"></i>
                        </a>` : ''}
                        
                        <!-- Quick Schedule -->
                        <button onclick="openApptModal('${client.id}')" class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Novo Agendamento">
                            <i data-lucide="calendar-plus" class="w-4 h-4"></i>
                        </button>

                        <!-- View Details (CRM) -->
                        <button onclick="openClientDetails('${client.id}')" class="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Ver Detalhes">
                            <i data-lucide="user" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

// CRM LOGIC
function openClientDetails(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return;

    // 1. Basic Info
    document.getElementById('cd-name').textContent = client.name;
    document.getElementById('cd-phone').textContent = client.phone || 'Sem telefone';

    // 2. Stats Calculation
    const clientTrans = db.transactions.filter(t => t.clientId === clientId && t.type === 'income');
    const totalSpent = clientTrans.reduce((sum, t) => sum + t.amount, 0);
    const visits = clientTrans.length;
    const avgTicket = visits > 0 ? (totalSpent / visits) : 0;

    document.getElementById('cd-total-spent').textContent = fmtMoney(totalSpent);
    document.getElementById('cd-visits').textContent = visits;
    document.getElementById('cd-avg-ticket').textContent = fmtMoney(avgTicket);

    // 3. Notes & Extra Info
    document.getElementById('cd-notes').textContent = client.notes || 'Nenhuma observação registrada.';
    document.getElementById('cd-birthday').textContent = client.birthDate ? fmtDate(client.birthDate) : '-';

    // Dates
    const sortedDates = clientTrans.map(t => new Date(t.date)).sort((a, b) => a - b);
    const firstVisit = sortedDates.length > 0 ? sortedDates[0] : null;
    const lastVisit = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

    document.getElementById('cd-first-visit').textContent = firstVisit ? firstVisit.toLocaleDateString('pt-BR') : '-';
    document.getElementById('cd-last-visit').textContent = lastVisit ? lastVisit.toLocaleDateString('pt-BR') : '-';

    // 4. Action Buttons
    const btnWa = document.getElementById('cd-btn-whatsapp');
    const rawPhone = client.phone ? client.phone.replace(/\D/g, '') : '';

    if (rawPhone) {
        btnWa.onclick = () => window.open(`https://wa.me/55${rawPhone}`, '_blank');
        btnWa.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btnWa.onclick = null;
        btnWa.classList.add('opacity-50', 'cursor-not-allowed');
    }

    document.getElementById('cd-btn-schedule').onclick = () => {
        closeModal('clientDetailsModal');
        openApptModal(client.id);
    };

    document.getElementById('cd-btn-edit').onclick = () => {
        closeModal('clientDetailsModal');
        openClientModal(client); // Reuse existing edit modal
    };

    // 5. History Timeline
    const historyContainer = document.getElementById('cd-history-list');
    if (clientTrans.length === 0) {
        historyContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Nenhum histórico encontrado.</p>';
    } else {
        historyContainer.innerHTML = clientTrans
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Newest first
            .map(t => `
                <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-white/5 transition-all">
                    <div>
                        <p class="font-bold text-slate-700 dark:text-white text-sm">${sanitizeHTML(t.description)}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">${fmtDate(t.date)} • ${t.proName || 'Barbearia'}</p>
                    </div>
                    <span class="font-bold text-green-600 dark:text-green-400 text-sm">${fmtMoney(t.amount)}</span>
                </div>
            `).join('');
    }

    // Show Modal
    const modal = document.getElementById('clientDetailsModal');
    modal.classList.remove('hidden');
    lucide.createIcons();
}
// MODAIS E FORMULÁRIOS
function openApptModal() {
    // Carregar Serviços
    const svcSelect = document.getElementById('ap-service');
    svcSelect.innerHTML = '<option value="">Selecione o Serviço...</option>';
    db.services.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.text = `${s.name} - ${fmtMoney(s.price)}`;
        opt.dataset.price = s.price;
        svcSelect.appendChild(opt);
    });
    // Carregar Barbeiros
    const proSelect = document.getElementById('ap-pro');
    proSelect.innerHTML = '<option value="">Selecione o Barbeiro...</option>';
    db.team.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.text = p.name;
        proSelect.appendChild(opt);
    });
    // Resetar campos
    document.getElementById('ap-id').value = '';
    document.getElementById('ap-client').value = '';
    document.getElementById('ap-time').value = '';
    document.getElementById('ap-display-val').textContent = 'R$ 0,00';
    document.getElementById('apptModal').classList.remove('hidden');
}
function updateApptValue() {
    const svcSelect = document.getElementById('ap-service');
    const price = svcSelect.options[svcSelect.selectedIndex].dataset.price || 0;
    document.getElementById('ap-display-val').textContent = fmtMoney(parseFloat(price));
}
function openTeamModal(professional = null) {
    if (professional) {
        document.getElementById('tm-id').value = professional.id;
        document.getElementById('tm-name').value = professional.name;
        document.getElementById('tm-comm').value = professional.commission;
        document.getElementById('tm-contract').value = professional.contract || 'PJ';
        document.getElementById('tm-phone').value = professional.phone || '';
        document.getElementById('tm-start-date').value = professional.startDate || '';
        document.getElementById('tm-notes').value = professional.notes || '';
        document.querySelector('#teamModal h3').textContent = 'Editar Barbeiro';
    } else {
        document.querySelector('#teamModal form').reset();
        document.getElementById('tm-id').value = '';
        document.getElementById('tm-contract').value = 'PJ';
        document.querySelector('#teamModal h3').textContent = 'Novo Barbeiro';
    }
    document.getElementById('teamModal').classList.remove('hidden');
}
function openServiceModal(service = null) {
    if (service) {
        document.getElementById('svc-id').value = service.id;
        document.getElementById('svc-name').value = service.name;
        document.getElementById('svc-price').value = service.price;
    } else {
        document.querySelector('#serviceModal form').reset();
        document.getElementById('svc-id').value = '';
    }
    document.getElementById('serviceModal').classList.remove('hidden');
}
function openExpenseModal() {
    document.querySelector('#expenseModal form').reset();
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    document.querySelector('#expenseModal h3').textContent = 'Lançar Movimentação';
    document.querySelector('#expenseModal button[type="submit"]').textContent = 'Salvar Lançamento';
    document.getElementById('expenseModal').classList.remove('hidden');
}
function editTransaction(id) {
    const transaction = db.transactions.find(t => t.id === id);
    if (!transaction) return;
    document.getElementById('exp-id').value = transaction.id;
    document.getElementById('exp-type').value = transaction.type;
    document.getElementById('exp-desc').value = transaction.description;
    document.getElementById('exp-amount').value = transaction.amount;
    document.getElementById('exp-date').value = transaction.date;
    document.getElementById('exp-category').value = transaction.category || 'outros';
    document.querySelector('#expenseModal h3').textContent = 'Editar Movimentação';
    document.querySelector('#expenseModal button[type="submit"]').textContent = 'Atualizar Lançamento';
    document.getElementById('expenseModal').classList.remove('hidden');
}
function openClientModal(client = null) {
    if (client) {
        document.getElementById('cli-id').value = client.id;
        document.getElementById('cli-name').value = client.name;
        document.getElementById('cli-phone').value = client.phone || '';
        document.getElementById('cli-email').value = client.email || '';
        document.getElementById('cli-birthdate').value = client.birthDate || '';
        document.getElementById('cli-notes').value = client.notes || '';
    } else {
        document.querySelector('#clientModal form').reset();
        document.getElementById('cli-id').value = '';
    }
    document.getElementById('clientModal').classList.remove('hidden');
}
function openClosingModal() {
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = db.transactions.filter(t => t.date === today);
    const incomeToday = todayTrans
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenseToday = todayTrans
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    const commissionToday = todayTrans
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.commission || 0), 0);
    const balanceToday = incomeToday - expenseToday - commissionToday;
    document.getElementById('close-inc').textContent = fmtMoney(incomeToday);
    document.getElementById('close-exp').textContent = fmtMoney(expenseToday);
    document.getElementById('close-com').textContent = fmtMoney(commissionToday);
    document.getElementById('close-bal').textContent = fmtMoney(balanceToday);
    document.getElementById('close-date').textContent = fmtDate(today);
    document.getElementById('close-time').textContent = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('closingModal').classList.remove('hidden');
}
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}
function updateApptValue() {
    const sel = document.getElementById('ap-service');
    const price = parseFloat(sel.options[sel.selectedIndex]?.getAttribute('data-price')) || 0;
    document.getElementById('ap-display-val').innerText = fmtMoney(price);
}
// CRUD OPERATIONS
function submitAppt(e) {
    e.preventDefault();
    const id = document.getElementById('ap-id').value;
    const client = document.getElementById('ap-client').value.trim();
    const date = document.getElementById('ap-date').value;
    const time = document.getElementById('ap-time').value;
    const serviceId = document.getElementById('ap-service').value;
    const proId = document.getElementById('ap-pro').value;
    const service = db.services.find(s => s.id === serviceId);
    const professional = db.team.find(t => t.id === proId);
    if (!client || !service || !professional) {
        alert('Por favor, preencha todos os campos corretamente.');
        return;
    }
    const appointment = {
        id: id || getID(),
        client,
        date,
        time,
        serviceId,
        serviceName: service.name,
        proId,
        proName: professional.name,
        price: service.price,
        status: 'pending',
        commissionPct: professional.commission,
        commissionVal: service.price * (professional.commission / 100)
    };
    if (id) {
        // Editar
        const index = db.appointments.findIndex(a => a.id === id);
        if (index !== -1) {
            db.appointments[index] = appointment;
        }
    } else {
        // Adicionar
        db.appointments.push(appointment);
    }
    save();
    closeModal('apptModal');
    renderDashboard();
    showNotification('Agendamento salvo com sucesso!', 'success');
}
function submitTeam(e) {
    e.preventDefault();
    const id = document.getElementById('tm-id').value;
    const name = document.getElementById('tm-name').value.trim();
    const commission = parseFloat(document.getElementById('tm-comm').value) || 0;
    const contract = document.getElementById('tm-contract').value;
    const phone = document.getElementById('tm-phone').value.trim();
    const startDate = document.getElementById('tm-start-date').value;
    const notes = document.getElementById('tm-notes').value.trim();

    if (!name) {
        showNotification('Por favor, insira o nome do barbeiro.', 'error');
        return;
    }

    const professional = {
        id: id || getID(),
        name,
        commission,
        contract,
        phone,
        startDate,
        notes
    };

    if (id) {
        const index = db.team.findIndex(t => t.id === id);
        if (index !== -1) {
            db.team[index] = professional;
        }
    } else {
        db.team.push(professional);
    }

    save();
    closeModal('teamModal');
    renderTeam();
    showNotification('Barbeiro salvo com sucesso!', 'success');
}
function submitService(e) {
    e.preventDefault();
    const id = document.getElementById('svc-id').value;
    const name = document.getElementById('svc-name').value.trim();
    const price = parseFloat(document.getElementById('svc-price').value) || 0;
    if (!name || price <= 0) {
        alert('Por favor, preencha todos os campos corretamente.');
        return;
    }
    const service = {
        id: id || getID(),
        name,
        price
    };
    if (id) {
        const index = db.services.findIndex(s => s.id === id);
        if (index !== -1) {
            db.services[index] = service;
        }
    } else {
        db.services.push(service);
    }
    save();
    closeModal('serviceModal');
    renderServices();
    showNotification('Serviço salvo com sucesso!', 'success');
}
function submitExpense(e) {
    e.preventDefault();
    const id = document.getElementById('exp-id').value;
    const type = document.getElementById('exp-type').value;
    const description = document.getElementById('exp-desc').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
    const date = document.getElementById('exp-date').value;
    const category = document.getElementById('exp-category').value;
    if (!description || amount <= 0) {
        alert('Por favor, preencha todos os campos corretamente.');
        return;
    }
    const transaction = {
        id: id || getID(),
        type: type, // 'income' or 'expense'
        description,
        amount,
        date,
        category
    };
    if (id) {
        const index = db.transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            db.transactions[index] = { ...db.transactions[index], ...transaction };
        }
    } else {
        db.transactions.push(transaction);
    }
    save();
    closeModal('expenseModal');
    if (document.getElementById('view-finance').classList.contains('hide') === false) {
        renderFinance();
    }
    const msg = id ? 'Lançamento atualizado!' : (type === 'income' ? 'Receita registrada!' : 'Despesa registrada!');
    showNotification(msg, 'success');
}
function submitClient(e) {
    e.preventDefault();
    const id = document.getElementById('cli-id').value;
    const name = document.getElementById('cli-name').value.trim();
    const phone = document.getElementById('cli-phone').value.trim();
    const email = document.getElementById('cli-email').value.trim();
    const birthDate = document.getElementById('cli-birthdate').value;
    const notes = document.getElementById('cli-notes').value.trim();

    if (!name) {
        alert('Por favor, insira o nome do cliente.');
        return;
    }

    // Preserve original creation date if editing
    let originalCreatedAt = new Date().toISOString();
    if (id) {
        const existing = db.clients.find(c => c.id === id);
        if (existing && existing.createdAt) {
            originalCreatedAt = existing.createdAt;
        }
    }

    const client = {
        id: id || getID(),
        name,
        phone: phone || null,
        email: email || null,
        birthDate: birthDate || null,
        notes: notes || null,
        createdAt: originalCreatedAt
    };

    if (id) {
        const index = db.clients.findIndex(c => c.id === id);
        if (index !== -1) {
            db.clients[index] = client;
        }
    } else {
        db.clients.push(client);
    }
    save();
    closeModal('clientModal');
    renderClients();
    showNotification('Cliente salvo com sucesso!', 'success');
}
// APPOINTMENT ACTIONS
function finishAppt(id) {
    if (!confirm('Finalizar corte e lançar no caixa?')) return;
    const index = db.appointments.findIndex(a => a.id === id);
    const appt = db.appointments[index];
    appt.status = 'done';
    // Criar transação de entrada
    const incomeTransaction = {
        id: getID(),
        type: 'income',
        description: `Serviço: ${appt.serviceName} - ${appt.client}`,
        amount: appt.price,
        date: appt.date,
        proId: appt.proId,
        proName: appt.proName,
        serviceId: appt.serviceId,
        clientId: findOrCreateClient(appt.client),
        commission: appt.commissionVal
    };
    db.transactions.push(incomeTransaction);
    save();
    renderDashboard();
    showNotification('Corte finalizado e lançado no caixa!', 'success');
}
function cancelAppt(id) {
    if (confirm('Cancelar este agendamento?')) {
        const index = db.appointments.findIndex(a => a.id === id);
        if (index !== -1) {
            db.appointments[index].status = 'canceled';
            save();
            renderDashboard();
            showNotification('Agendamento cancelado!', 'success');
        }
    }
}

// EDIT FUNCTIONS
function editTeam(id) {
    const professional = db.team.find(p => p.id === id);
    if (professional) {
        openTeamModal(professional);
    }
}

function editService(id) {
    const service = db.services.find(s => s.id === id);
    if (service) {
        openServiceModal(service);
    }
}

function editClient(id) {
    const client = db.clients.find(c => c.id === id);
    if (client) {
        // We need to implement openClientModal or similar if it doesn't exist, 
        // but based on renderClients, we have openClientDetails. 
        // Let's check if there is an openClientModal for editing.
        // For now, let's assuming client editing might be needed too.
        // Checking app.html line 1591 shows 'clientModal'.
        // We need to see if openClientModal handles data.
        // For now, sticking to the requested Team and Service edits.
        // But wait, the original code had editClient too.
        const modal = document.getElementById('clientModal');
        if (modal) {
            document.getElementById('cli-id').value = client.id;
            document.getElementById('cli-name').value = client.name;
            document.getElementById('cli-phone').value = client.phone;
            document.getElementById('cli-email').value = client.email || '';
            document.getElementById('cli-birthdate').value = client.birthDate || '';
            document.getElementById('cli-notes').value = client.notes || '';
            modal.classList.remove('hidden');
        }
    }
}

// REPORTS
function generateReport() {
    const start = document.getElementById('rep-start').value;
    const end = document.getElementById('rep-end').value;

    if (!start || !end) {
        alert('Selecione um período.');
        return;
    }

    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');

    let income = 0;
    let expense = 0;
    let commission = 0;
    const serviceCounts = {};

    db.transactions.forEach(t => {
        const tDate = new Date(t.date); // Presumes ISO string or valid date
        if (isNaN(tDate.getTime())) return; // Skip invalid dates

        // Ajuste simples de data (comparação de string também funcionaria se ISO)
        // Mas objeto Date é mais seguro para ranges
        if (tDate >= startDate && tDate <= endDate) {
            const val = parseFloat(t.amount || 0);

            if (t.type === 'income') {
                income += val;
                commission += parseFloat(t.commission || 0);

                // Track services
                if (t.description && t.description.startsWith('Serviço:')) {
                    const svcName = t.description.split(' - ')[0].replace('Serviço: ', '').trim();
                    serviceCounts[svcName] = (serviceCounts[svcName] || 0) + 1;
                }

            } else if (t.type === 'expense') {
                expense += val;
            }
        }
    });

    // Update UI
    document.getElementById('rep-inc').innerText = fmtMoney(income);
    document.getElementById('rep-exp').innerText = fmtMoney(expense);
    document.getElementById('rep-com').innerText = fmtMoney(commission);

    // Top Services
    const sortedServices = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const topSvcsEl = document.getElementById('top-services');
    topSvcsEl.innerHTML = sortedServices.map(([name, count], i) => `
        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-white/5">
            <div class="flex items-center gap-3">
                <span class="font-bold text-slate-400 dark:text-slate-600">#${i + 1}</span>
                <span class="font-medium text-slate-700 dark:text-slate-300">${name}</span>
            </div>
            <span class="bg-blue-100 dark:bg-blue-900/30 text-brand-blue dark:text-brand-lightblue text-xs font-bold px-2 py-1 rounded-full">${count} cortes</span>
        </div>
    `).join('') || '<p class="text-sm text-slate-400 dark:text-slate-500 text-center">Nenhum serviço neste período.</p>';

    document.getElementById('report-result').classList.remove('hide');
}

function generateMonthReport() {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Formato YYYY-MM-DD local
    const toLocalISO = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    document.getElementById('rep-start').value = toLocalISO(firstDay);
    document.getElementById('rep-end').value = toLocalISO(lastDay);

    generateReport();
}

function shareReport() {
    const start = document.getElementById('rep-start').value;
    const end = document.getElementById('rep-end').value;
    const inc = document.getElementById('rep-inc').innerText;
    const exp = document.getElementById('rep-exp').innerText;
    const com = document.getElementById('rep-com').innerText;

    if (!start || !end) {
        alert('Gere um relatório primeiro!');
        return;
    }

    const fmtDateBr = (d) => d.split('-').reverse().join('/');

    const text = `📊 *Relatório Financeiro*
📅 Período: ${fmtDateBr(start)} a ${fmtDateBr(end)}

💰 *Receita:* ${inc}
💸 *Despesas:* ${exp}
🤝 *Comissões:* ${com}

Gerado pelo Sistema de Gestão.`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}
function findOrCreateClient(name) {
    let client = db.clients.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!client) {
        client = {
            id: getID(),
            name,
            createdAt: new Date().toISOString()
        };
        db.clients.push(client);
    }
    return client.id;
}
// COMMISSIONS
let currentCommissionData = null;
function payCommission(proId) {
    const pendingTransactions = db.transactions.filter(t =>
        t.proId === proId && t.type === 'income' && !t.commissionPaid
    );
    if (pendingTransactions.length === 0) {
        alert('Não há comissões pendentes para este barbeiro.');
        return;
    }
    const totalCommission = pendingTransactions.reduce((sum, t) => sum + (t.commission || 0), 0);
    const professional = db.team.find(t => t.id === proId);
    // Store data for the modal actions
    currentCommissionData = {
        proId: proId,
        proName: professional.name,
        amount: totalCommission,
        date: new Date().toISOString().split('T')[0]
    };
    // Fill Modal
    document.getElementById('comm-pro-name').innerText = professional.name;
    document.getElementById('comm-value').innerText = fmtMoney(totalCommission);
    // Show Modal
    document.getElementById('commissionModal').classList.remove('hidden');
}
function confirmCommissionPayment() {
    if (!currentCommissionData) return;
    // Generate Expense
    const expenseTransaction = {
        id: getID(),
        description: `Pagamento Comissão: ${currentCommissionData.proName}`,
        amount: currentCommissionData.amount,
        date: currentCommissionData.date,
        category: 'comissao'
    };
    db.transactions.push(expenseTransaction);
    // Mark transactions as paid
    db.transactions.forEach(t => {
        if (t.proId === currentCommissionData.proId && t.type === 'income' && !t.commissionPaid) {
            t.commissionPaid = true;
            t.commissionPaidDate = currentCommissionData.date;
        }
    });
    save();
    renderFinance(); // Ensure finance view updates if active
    renderTeam();    // Refresh team list to disable button
    closeModal('commissionModal');
    showNotification('Comissão paga com sucesso!', 'success');
    currentCommissionData = null;
}
function shareCommissionWhatsApp() {
    if (!currentCommissionData) return;

    const salonName = db.settings.businessName || 'SUA BARBEARIA';
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let msg = `🧾 *RECIBO DE COMISSÃO*\n`;
    msg += `💈 *${salonName.toUpperCase()}*\n`;
    msg += `📅 Data: ${date} às ${time}\n`;
    msg += `--------------------------------\n`;
    msg += `👤 *Profissional:* ${currentCommissionData.proName}\n`;
    msg += `💰 *Valor Pago:* ${fmtMoney(currentCommissionData.amount)}\n`;
    msg += `--------------------------------\n`;
    msg += `✅ *PAGAMENTO REALIZADO*\n`;
    msg += `_Comprovante digital gerado pelo sistema._`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function printCommissionReceipt() {
    if (!currentCommissionData) return;

    const salonName = db.settings.businessName || 'SUA BARBEARIA';
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const createReceiptBlock = (title) => `
        <div style="font-family: 'Courier New', monospace; padding: 10px; max-width: 300px; margin: 0 auto; border: 1px dashed #000; margin-bottom: 20px;">
            <h2 style="text-align: center; margin: 0; font-size: 18px;">${salonName.toUpperCase()}</h2>
            <p style="text-align: center; font-size: 12px; margin: 5px 0 15px 0; border-bottom: 1px solid #000; padding-bottom: 5px;">${title}</p>
            
            <p style="margin: 5px 0; font-size: 12px;"><strong>DATA:</strong> ${date} ${time}</p>
            <p style="margin: 5px 0; font-size: 12px;"><strong>PROFISSIONAL:</strong><br>${currentCommissionData.proName}</p>
            <p style="margin: 5px 0; font-size: 12px;"><strong>TIPO:</strong> COMISSÃO DE SERVIÇOS</p>
            
            <table style="width: 100%; margin-top: 15px; border-top: 1px dashed #000;">
                <tr>
                    <td style="font-size: 16px; padding-top: 5px;"><strong>TOTAL PAGO:</strong></td>
                    <td style="font-size: 16px; text-align: right; padding-top: 5px;"><strong>${fmtMoney(currentCommissionData.amount)}</strong></td>
                </tr>
            </table>
            
            <div style="margin-top: 30px; text-align: center;">
                <div style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                <p style="font-size: 10px; margin: 0;">ASSINATURA DO PROFISSIONAL</p>
            </div>

            <div style="margin-top: 25px; text-align: center;">
                <div style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                <p style="font-size: 10px; margin: 0;">ASSINATURA DO RESPONSÁVEL</p>
            </div>
            
            <p style="text-align: center; font-size: 9px; margin-top: 15px; color: #666;">Sistema de Gestão - ${new Date().getFullYear()}</p>
        </div>
    `;

    const content = `
        <html>
        <head>
            <title>Recibo de Comissão</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0; }
                    @page { margin: 0; }
                }
            </style>
        </head>
        <body>
            ${createReceiptBlock('RECIBO - VIA DO PROFISSIONAL')}
            <div style="text-align: center; margin: 10px 0; font-size: 10px; color: #999;">----------------- CORTE AQUI -----------------</div>
            ${createReceiptBlock('RECIBO - VIA DA BARBEARIA')}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `;

    const win = window.open('', '_blank', 'width=350,height=800');
    win.document.write(content);
    win.document.close();
}
function printClosing() {
    const inc = document.getElementById('close-inc').textContent;
    const exp = document.getElementById('close-exp').textContent;
    const com = document.getElementById('close-com').textContent;
    const bal = document.getElementById('close-bal').textContent;
    const salonName = db.settings.businessName || 'SUA BARBEARIA';
    const dateStr = new Date().toLocaleDateString('pt-BR');
    const timeStr = new Date().toLocaleTimeString('pt-BR');
    const receiptHTML = `
                <div style="font-family: 'Courier New', monospace; padding: 40px; max-width: 800px; margin: 0 auto; color: #000;">
                    <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 20px; margin-bottom: 30px;">
                        <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">${salonName}</h1>
                        <p style="margin: 5px 0; font-size: 14px;">RELATÓRIO DE FECHAMENTO DE CAIXA</p>
                        <p style="margin: 5px 0; font-size: 12px;">Data: ${dateStr} - Hora: ${timeStr}</p>
                    </div>
                    <div style="margin-bottom: 30px;">
                        <h3 style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 15px;">RESUMO FINANCEIRO</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">(+) Total de Entradas</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${inc}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">(-) Despesas Operacionais</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${exp}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">(-) Comissões Pagas/Previstas</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${com}</td>
                            </tr>
                            <tr style="font-size: 18px;">
                                <td style="padding: 15px 0; font-weight: bold;">(=) SALDO EM CAIXA</td>
                                <td style="padding: 15px 0; text-align: right; font-weight: bold;">${bal}</td>
                            </tr>
                        </table>
                    </div>
                    <div style="margin-top: 50px;">
                        <div style="border: 1px solid #000; padding: 15px; font-size: 12px; text-align: center; margin-bottom: 50px;">
                            <p style="font-weight: bold; margin-bottom: 5px;">DECLARAÇÃO DE CONFERÃŠNCIA</p>
                            <p>Declaro que os valores acima conferem com o numerário físico e comprovantes em caixa nesta data.</p>
                        </div>
                        <div style="display: flex; justify-content: space-between; gap: 40px;">
                            <div style="flex: 1; text-align: center;">
                                <div style="border-top: 1px solid #000; padding-top: 10px;">
                                    Responsável pelo Caixa
                                </div>
                            </div>
                            <div style="flex: 1; text-align: center;">
                                <div style="border-top: 1px solid #000; padding-top: 10px;">
                                    Gerência / Auditoria
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #666; border-top: 1px dotted #ccc; padding-top: 10px;">
                        Documento gerado eletronicamente por Sistema de Gestão V4 Pro<br>
                        ${new Date().toLocaleString('pt-BR')}
                    </div>
                </div>
            `;
    // 3. Criar Iframe Invisível (Técnica Robusta)
    const iframe = document.createElement('iframe');
    // Posicionamento fora da tela (melhor que display:none para impressão)
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    document.body.appendChild(iframe);
    // 4. Escrever e Imprimir
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(receiptHTML);
    doc.close();
    // Executar com pequeno delay para garantir renderização das fontes
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Limpeza após impressão
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 2000);
    }, 500);
}
function updatePrintHeaders() {
    const s = db.settings;
    // Header estilo Barbearia (Ajustado)
    const headerHTML = `
                <div class="print-header" style="text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px;">
                    <h2 style="font-size: 24px; font-weight: bold; color: #000; margin: 0; text-transform: uppercase; font-family: 'Courier New', monospace;">${s.businessName || 'BARBEARIA'}</h2>
                    <p style="font-size: 14px; color: #000; margin: 5px 0 0 0; font-family: 'Courier New', monospace;">RELATÓRIO GERENCIAL</p>
                    <p style="font-size: 12px; color: #000; margin: 0; font-family: 'Courier New', monospace;">${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR')}</p>
                </div>
            `;
    const containers = [
        document.getElementById('report-result')
    ];
    containers.forEach(container => {
        if (!container) return;
        const existing = container.querySelector('.print-header');
        if (existing) existing.outerHTML = headerHTML;
        else container.insertAdjacentHTML('afterbegin', headerHTML);
    });
}
function printReport() {
    updatePrintHeaders();
    window.print();
}
function printFinanceReport() {
    updatePrintHeaders();
    window.print();
}
// SETTINGS
function saveBusinessInfo() {
    db.settings.businessName = document.getElementById('biz-name').value;
    db.settings.businessOwner = document.getElementById('biz-owner').value;
    db.settings.businessDoc = document.getElementById('biz-doc').value;
    db.settings.businessHours = document.getElementById('biz-hours').value;
    save();
    showNotification('Informações salvas com sucesso!', 'success');
}
// BACKUP E RESTAURAÇÃO
function downloadBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "brand_barbearia_backup.json");
    document.body.appendChild(downloadAnchorNode); // Required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showNotification('Backup baixado! Guarde em local seguro (nuvem/email).', 'success');
}

// NOTIFICATION SYSTEM
function showNotification(message, type = 'info') {
    const colors = {
        success: 'bg-green-600 dark:bg-green-500',
        error: 'bg-red-600 dark:bg-red-500',
        info: 'bg-blue-600 dark:bg-brand-blue',
        warning: 'bg-orange-500'
    };
    const colorClass = colors[type] || colors.info;

    // Criar elemento
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colorClass} text-white px-6 py-3 rounded-xl shadow-2xl z-[100] transform transition-all duration-300 translate-y-[-20%] opacity-0 flex items-center gap-2 font-bold backdrop-blur-md border border-white/10`;
    notification.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}" class="w-5 h-5"></i>
        <span>${sanitizeHTML(message)}</span>
    `;

    document.body.appendChild(notification);
    lucide.createIcons();

    // Animar entrada
    requestAnimationFrame(() => {
        notification.classList.remove('translate-y-[-20%]', 'opacity-0');
    });

    // Remover após 3 segundos
    setTimeout(() => {
        notification.classList.add('translate-y-[-20%]', 'opacity-0');
        setTimeout(() => notification.remove(), 300);
    }, 3500);
}
function restoreBackup(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const backup = JSON.parse(e.target.result);

            // Validação de estrutura básica
            if (!backup.settings || !Array.isArray(backup.appointments)) {
                showNotification('Arquivo inválido: Estrutura irreconhecível.', 'error');
                return;
            }

            // Validação rigorosa de tipos (Security Audit)
            const arrayKeys = ['appointments', 'team', 'services', 'transactions', 'clients'];
            const objectKeys = ['settings'];

            const isArraysValid = arrayKeys.every(key => Array.isArray(backup[key] || [])); // Allow missing keys as empty arrays
            const isObjectsValid = objectKeys.every(key => typeof (backup[key] || {}) === 'object');

            if (isArraysValid && isObjectsValid) {
                // Sanitização profunda do backup antes de carregar
                const sanitizeObj = (obj) => {
                    if (typeof obj === 'string') return sanitizeHTML(obj);
                    if (Array.isArray(obj)) return obj.map(sanitizeObj);
                    if (typeof obj === 'object' && obj !== null) {
                        Object.keys(obj).forEach(key => {
                            obj[key] = sanitizeObj(obj[key]);
                        });
                        return obj;
                    }
                    return obj;
                };

                // Merge seguro: mantém padrão se chave faltar
                db = { ...defaultDB, ...sanitizeObj(backup) };

                save();
                showNotification('Backup restaurado com sucesso! Atualizando...', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                showNotification('Arquivo corrompido ou formato incompatível.', 'error');
            }
        } catch (err) {
            console.error(err);
            showNotification('Erro ao processar arquivo. Tente novamente.', 'error');
        }
    };
    reader.readAsText(file);
}
function clearAllData() {
    if (confirm('Tem certeza que deseja limpar TODOS os dados? Esta ação é irreversível!')) {
        db.appointments = [];
        db.transactions = [];
        save();
        renderDashboard();
        renderFinance();
        showNotification('Todos os dados foram removidos!', 'success');
    }
}
function factoryReset() {
    if (confirm('ATENÇÃO: Isso resetará TODO o sistema para as configurações de fábrica. Todos os dados serão perdidos. Tem certeza?')) {
        localStorage.removeItem(DB_KEY);
        location.reload();
    }
}
function clearFinanceFilters() {
    const firstDay = new Date();
    firstDay.setDate(1);
    const firstDayStr = firstDay.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('search-term').value = '';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-start').value = firstDayStr;
    document.getElementById('filter-end').value = today;
    renderFinance();
}
// UTILITÁRIOS GERAIS
function updateDataStatus() {
    const totalAppts = db.appointments.length;
    const totalServices = db.services.length;
    const totalClients = db.clients.length;
    // Status dos dados atualizado
}

// OFFLINE SUPPORT
window.addEventListener('online', () => {
    showNotification('Conexão restaurada!', 'success');
});
window.addEventListener('offline', () => {
    showNotification('Modo offline ativado. Seus dados estão seguros localmente.', 'warning');
});
// === MANUAL INTERATIVO PADRONIZADO ===
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
function markSectionComplete(sectionId) {
    let completed = JSON.parse(localStorage.getItem('brand_manual_completed') || '[]');
    if (!completed.includes(sectionId)) {
        completed.push(sectionId);
        localStorage.setItem('brand_manual_completed', JSON.stringify(completed));
        showNotification('Etapa concluída!', 'success');
    }
    updateTutorialProgress();
}
function updateTutorialProgress() {
    const sections = ['instalacao', 'primeiro-cadastro', 'agendamentos', 'relatorios', 'backup', 'duvidas', 'checklist'];
    const completed = JSON.parse(localStorage.getItem('brand_manual_completed') || '[]');
    const total = sections.length;
    const percent = Math.round((completed.length / total) * 100);
    const progressBar = document.getElementById('tutorial-progress');
    const completedSteps = document.getElementById('completed-steps');
    if (progressBar) progressBar.style.width = percent + '%';
    if (completedSteps) completedSteps.textContent = `${completed.length}/${total} etapas`;
    // Atualizar visual dos botões
    sections.forEach(id => {
        const btn = document.querySelector(`[onclick="scrollToSection('${id}')"]`);
        if (btn) {
            if (completed.includes(id)) {
                btn.classList.add('bg-green-100', 'dark:bg-green-900/30', 'border-green-300', 'dark:border-green-800/50', 'text-green-700', 'dark:text-green-400');
                btn.classList.remove('border-gray-200', 'dark:border-white/10');
            } else {
                btn.classList.remove('bg-green-100', 'dark:bg-green-900/30', 'border-green-300', 'dark:border-green-800/50', 'text-green-700', 'dark:text-green-400');
                btn.classList.add('border-gray-200', 'dark:border-white/10');
            }
        }
    });
}
function updateChecklist() {
    const checkboxes = document.querySelectorAll('#checklist input[type="checkbox"]');
    const totalTasks = checkboxes.length;
    let completedTasks = 0;
    const checklistState = {};
    checkboxes.forEach(cb => {
        checklistState[cb.id] = cb.checked;
        if (cb.checked) completedTasks++;
        // Estilo visual do item
        const item = cb.closest('.checklist-item');
        if (item) {
            if (cb.checked) {
                item.classList.add('opacity-60');
                item.querySelector('span').classList.add('line-through');
            } else {
                item.classList.remove('opacity-60');
                item.querySelector('span').classList.remove('line-through');
            }
        }
    });
    localStorage.setItem('brand_checklist_state', JSON.stringify(checklistState));
    const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const percentEl = document.getElementById('checklist-percent');
    const progressEl = document.getElementById('checklist-progress');
    const completedEl = document.getElementById('checklist-completed');
    const totalEl = document.getElementById('checklist-total');
    if (percentEl) percentEl.textContent = percent + '%';
    if (progressEl) progressEl.style.width = percent + '%';
    if (completedEl) completedEl.textContent = completedTasks;
    if (totalEl) totalEl.textContent = totalTasks;
    // Atualizar próximas tarefas
    const nextTasks = document.getElementById('next-tasks');
    if (nextTasks) {
        const unchecked = Array.from(checkboxes).filter(cb => !cb.checked).slice(0, 2);
        if (unchecked.length > 0) {
            nextTasks.innerHTML = unchecked.map(cb => {
                const text = cb.nextElementSibling.textContent;
                return `<div class="flex items-center gap-2 text-xs text-gray-300">
                                    <i data-lucide="circle" class="w-3 h-3"></i>
                                    <span>${text}</span>
                                </div>`;
            }).join('');
        } else {
            nextTasks.innerHTML = `<div class="flex items-center gap-2 text-xs text-green-400 font-bold">
                                                <i data-lucide="check-circle" class="w-3 h-3"></i>
                                                <span>Tudo em dia!</span>
                                            </div>`;
        }
        lucide.createIcons();
    }
}
function loadChecklistState() {
    const saved = JSON.parse(localStorage.getItem('brand_checklist_state') || '{}');
    Object.keys(saved).forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = saved[id];
    });
    updateChecklist();
}
function showExample(type) {
    showNotification(`Exemplo de ${type} carregado!`, 'info');
}
// INICIALIZAR APLICATIVO
document.addEventListener('DOMContentLoaded', init);
// Carregar estado do manual ao carregar página
document.addEventListener('DOMContentLoaded', () => {
    updateTutorialProgress();
    loadChecklistState();

    // Auto-check receipt status
    const confirmed = localStorage.getItem('ml_receipt_confirmed');
    if (confirmed === 'true') {
        const btn = document.getElementById('btn-confirm-terms');
        const badge = document.getElementById('terms-accepted-badge');
        const dateEl = document.getElementById('terms-date');

        if (btn && badge) {
            btn.classList.add('hidden');
            badge.classList.remove('hidden');
            if (dateEl) dateEl.textContent = 'Confirmado em: ' + (localStorage.getItem('ml_receipt_date') || 'Anteriormente');
        }
    }
});

// Função consolidada em checkAirlock e blocos superiores

// ==========================================
// MISSING MODAL FUNCTIONS (Restored)
// ==========================================

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function openTeamModal(professional = null) {
    const modal = document.getElementById('teamModal');
    if (!modal) return;

    // Reset form
    document.getElementById('tm-id').value = '';
    document.getElementById('tm-name').value = '';
    document.getElementById('tm-comm').value = '50';

    if (professional) {
        document.getElementById('tm-id').value = professional.id;
        document.getElementById('tm-name').value = professional.name;
        document.getElementById('tm-comm').value = professional.commission;
    }
    modal.classList.remove('hidden');
}

function openServiceModal(service = null) {
    const modal = document.getElementById('serviceModal');
    if (!modal) return;

    // Reset form
    document.getElementById('svc-id').value = '';
    document.getElementById('svc-name').value = '';
    document.getElementById('svc-price').value = '';

    if (service) {
        document.getElementById('svc-id').value = service.id;
        document.getElementById('svc-name').value = service.name;
        document.getElementById('svc-price').value = service.price;
    }
    modal.classList.remove('hidden');
}

function openClientModal(client = null) {
    const modal = document.getElementById('clientModal');
    if (!modal) return;

    // Clear fields first
    document.getElementById('cli-id').value = '';
    document.getElementById('cli-name').value = '';
    document.getElementById('cli-phone').value = '';
    document.getElementById('cli-email').value = '';
    document.getElementById('cli-birthdate').value = '';
    document.getElementById('cli-notes').value = '';

    if (client) {
        document.getElementById('cli-id').value = client.id;
        document.getElementById('cli-name').value = client.name;
        document.getElementById('cli-phone').value = client.phone;
        document.getElementById('cli-email').value = client.email || '';
        document.getElementById('cli-birthdate').value = client.birthDate || '';
        document.getElementById('cli-notes').value = client.notes || '';
    }
    modal.classList.remove('hidden');
}

// ==========================================
// CONTROLE DE ESTOQUE
// ==========================================
const INVENTORY_CATEGORIES = {
    cosmeticos: 'Cosméticos',
    laminas: 'Lâminas/Descartáveis',
    higiene: 'Higiene',
    equipamentos: 'Equipamentos',
    bebidas: 'Bebidas',
    outros: 'Outros'
};
const MOVEMENT_REASONS = {
    compra: 'Compra',
    venda: 'Venda',
    uso_interno: 'Uso Interno',
    perda: 'Perda/Avaria',
    ajuste: 'Ajuste Manual'
};

function getProductStatus(product) {
    if (product.quantity <= 0) return { label: 'Esgotado', key: 'critical', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' };
    if (product.quantity <= product.minQuantity) return { label: 'Baixo', key: 'low', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400' };
    return { label: 'OK', key: 'ok', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' };
}

function getInventoryStats() {
    const totalProducts = db.inventory.length;
    const totalValue = db.inventory.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0);
    const lowStock = db.inventory.filter(p => p.quantity <= p.minQuantity).length;
    const today = new Date();
    const movementsMonth = db.stockMovements.filter(m => {
        const mDate = new Date(m.date);
        return mDate.getMonth() === today.getMonth() && mDate.getFullYear() === today.getFullYear();
    }).length;
    return { totalProducts, totalValue, lowStock, movementsMonth };
}

function renderInventory() {
    const stats = getInventoryStats();
    document.getElementById('inv-total-products').textContent = stats.totalProducts;
    document.getElementById('inv-total-value').textContent = fmtMoney(stats.totalValue);
    document.getElementById('inv-low-stock').textContent = stats.lowStock;
    document.getElementById('inv-movements-month').textContent = stats.movementsMonth;

    const searchTerm = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const filterCategory = document.getElementById('inv-filter-category')?.value || 'all';
    const filterStatus = document.getElementById('inv-filter-status')?.value || 'all';

    let filtered = db.inventory.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm) ||
            (p.supplier && p.supplier.toLowerCase().includes(searchTerm));
        const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
        const status = getProductStatus(p);
        const matchesStatus = filterStatus === 'all' || status.key === filterStatus;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    const tbody = document.getElementById('inventory-list');
    const emptyMsg = document.getElementById('inv-empty-msg');

    if (filtered.length === 0 && db.inventory.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        emptyMsg.innerHTML = `
            <i data-lucide="package-open" class="w-16 h-16 mx-auto mb-4 text-slate-200 dark:text-slate-700"></i>
            <p class="text-slate-400 dark:text-slate-500 font-medium">Nenhum produto cadastrado</p>
            <p class="text-xs text-slate-300 dark:text-slate-600 mt-1">Clique em "Novo Produto" para começar</p>
        `;
    } else if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        emptyMsg.innerHTML = `
            <i data-lucide="search-x" class="w-12 h-12 mx-auto mb-3 text-slate-200 dark:text-slate-700"></i>
            <p class="text-slate-400 dark:text-slate-500 font-medium">Nenhum produto encontrado</p>
            <p class="text-xs text-slate-300 dark:text-slate-600 mt-1">Tente ajustar os filtros</p>
        `;
    } else {
        emptyMsg.classList.add('hidden');
        tbody.innerHTML = filtered.map(p => {
            const status = getProductStatus(p);
            const catLabel = INVENTORY_CATEGORIES[p.category] || p.category;
            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-white/5 transition-colors">
                    <td class="px-6 py-4">
                        <div class="font-medium text-slate-800 dark:text-white">${sanitizeHTML(p.name)}</div>
                        ${p.supplier ? `<div class="text-xs text-slate-400 dark:text-slate-500">${sanitizeHTML(p.supplier)}</div>` : ''}
                    </td>
                    <td class="px-6 py-4">
                        <span class="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">${sanitizeHTML(catLabel)}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="font-bold text-lg ${p.quantity <= p.minQuantity ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}">${p.quantity}</span>
                    </td>
                    <td class="px-6 py-4 text-center text-slate-500 dark:text-slate-400">${p.minQuantity}</td>
                    <td class="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">${fmtMoney(p.unitPrice)}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${status.color}">${status.label}</span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex justify-end gap-1">
                            <button onclick="openStockMovementModal('${p.id}')" class="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Movimentar">
                                <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
                            </button>
                            <button onclick="openInventoryModal(db.inventory.find(x=>x.id==='${p.id}'))" class="p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Editar">
                                <i data-lucide="edit-2" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteInventoryProduct('${p.id}')" class="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Excluir">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderRecentMovements();
    lucide.createIcons();
}

function renderRecentMovements() {
    const container = document.getElementById('inv-movements-list');
    const emptyEl = document.getElementById('inv-movements-empty');
    const recent = [...db.stockMovements]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 15);

    if (recent.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    container.innerHTML = recent.map(m => {
        const isIn = m.type === 'in';
        const reasonLabel = MOVEMENT_REASONS[m.reason] || m.reason;
        return `
            <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-slate-50 dark:border-white/5">
                <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIn ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}">
                    <i data-lucide="${isIn ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4 ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <p class="text-sm font-medium text-slate-800 dark:text-white truncate">${sanitizeHTML(m.productName)}</p>
                        <span class="text-xs font-bold flex-shrink-0 ml-2 ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">${isIn ? '+' : '-'}${m.quantity}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[10px] text-slate-400 dark:text-slate-500">${fmtDate(m.date)}</span>
                        <span class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">${sanitizeHTML(reasonLabel)}</span>
                        ${m.notes ? `<span class="text-[10px] text-slate-400 dark:text-slate-600 truncate">${sanitizeHTML(m.notes)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterInventory() {
    renderInventory();
}

function openInventoryModal(product = null) {
    const modal = document.getElementById('inventoryModal');
    if (!modal) return;

    document.getElementById('inv-id').value = '';
    document.getElementById('inv-name').value = '';
    document.getElementById('inv-category').value = 'cosmeticos';
    document.getElementById('inv-price').value = '';
    document.getElementById('inv-quantity').value = '';
    document.getElementById('inv-min-quantity').value = '';
    document.getElementById('inv-supplier').value = '';
    document.getElementById('inv-notes').value = '';
    document.getElementById('inv-modal-title').textContent = 'Novo Produto';

    if (product) {
        document.getElementById('inv-id').value = product.id;
        document.getElementById('inv-name').value = product.name;
        document.getElementById('inv-category').value = product.category;
        document.getElementById('inv-price').value = product.unitPrice;
        document.getElementById('inv-quantity').value = product.quantity;
        document.getElementById('inv-min-quantity').value = product.minQuantity;
        document.getElementById('inv-supplier').value = product.supplier || '';
        document.getElementById('inv-notes').value = product.notes || '';
        document.getElementById('inv-modal-title').textContent = 'Editar Produto';
    }

    modal.classList.remove('hidden');
    lucide.createIcons();
}

function submitInventoryProduct(e) {
    e.preventDefault();
    const id = document.getElementById('inv-id').value;
    const name = document.getElementById('inv-name').value.trim();
    const category = document.getElementById('inv-category').value;
    const unitPrice = parseFloat(document.getElementById('inv-price').value) || 0;
    const quantity = parseInt(document.getElementById('inv-quantity').value) || 0;
    const minQuantity = parseInt(document.getElementById('inv-min-quantity').value) || 0;
    const supplier = document.getElementById('inv-supplier').value.trim();
    const notes = document.getElementById('inv-notes').value.trim();

    if (!name) {
        showNotification('Nome do produto é obrigatório!', 'warning');
        return;
    }

    if (id) {
        const idx = db.inventory.findIndex(p => p.id === id);
        if (idx !== -1) {
            const oldQty = db.inventory[idx].quantity;
            db.inventory[idx] = { ...db.inventory[idx], name, category, unitPrice, quantity, minQuantity, supplier, notes };
            if (quantity !== oldQty) {
                const diff = quantity - oldQty;
                db.stockMovements.push({
                    id: getID(),
                    productId: id,
                    productName: name,
                    type: diff > 0 ? 'in' : 'out',
                    quantity: Math.abs(diff),
                    reason: 'ajuste',
                    date: new Date().toISOString().split('T')[0],
                    notes: 'Ajuste via edição do produto'
                });
            }
            showNotification('Produto atualizado com sucesso!', 'success');
        }
    } else {
        const newProduct = {
            id: getID(),
            name,
            category,
            unitPrice,
            quantity,
            minQuantity,
            supplier,
            notes,
            createdAt: new Date().toISOString()
        };
        db.inventory.push(newProduct);
        if (quantity > 0) {
            db.stockMovements.push({
                id: getID(),
                productId: newProduct.id,
                productName: name,
                type: 'in',
                quantity,
                reason: 'ajuste',
                date: new Date().toISOString().split('T')[0],
                notes: 'Estoque inicial'
            });
        }
        showNotification('Produto cadastrado com sucesso!', 'success');
    }

    save();
    closeModal('inventoryModal');
    renderInventory();
}

function deleteInventoryProduct(id) {
    const product = db.inventory.find(p => p.id === id);
    if (!product) return;
    if (!confirm(`Excluir o produto "${product.name}"? Esta ação não pode ser desfeita.`)) return;

    db.inventory = db.inventory.filter(p => p.id !== id);
    db.stockMovements = db.stockMovements.filter(m => m.productId !== id);
    save();
    renderInventory();
    showNotification('Produto excluído.', 'info');
}

function openStockMovementModal(productId = null) {
    const modal = document.getElementById('stockMovementModal');
    if (!modal) return;

    const select = document.getElementById('mov-product');
    select.innerHTML = '<option value="">Selecione um produto...</option>' +
        db.inventory.map(p => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${sanitizeHTML(p.name)} (${p.quantity} un)</option>`).join('');

    document.getElementById('mov-type').value = 'in';
    document.getElementById('mov-quantity').value = '';
    document.getElementById('mov-reason').value = 'compra';
    document.getElementById('mov-notes').value = '';

    if (productId) {
        updateMovementProductInfo();
    } else {
        document.getElementById('mov-product-info').classList.add('hidden');
    }

    modal.classList.remove('hidden');
    lucide.createIcons();
}

function updateMovementProductInfo() {
    const productId = document.getElementById('mov-product').value;
    const infoDiv = document.getElementById('mov-product-info');
    if (!productId) {
        infoDiv.classList.add('hidden');
        return;
    }
    const product = db.inventory.find(p => p.id === productId);
    if (product) {
        document.getElementById('mov-current-stock').textContent = product.quantity + ' unidades';
        infoDiv.classList.remove('hidden');
    }
}

function submitStockMovement(e) {
    e.preventDefault();
    const productId = document.getElementById('mov-product').value;
    const type = document.getElementById('mov-type').value;
    const quantity = parseInt(document.getElementById('mov-quantity').value) || 0;
    const reason = document.getElementById('mov-reason').value;
    const notes = document.getElementById('mov-notes').value.trim();

    if (!productId) {
        showNotification('Selecione um produto!', 'warning');
        return;
    }
    if (quantity <= 0) {
        showNotification('Quantidade deve ser maior que zero!', 'warning');
        return;
    }

    const product = db.inventory.find(p => p.id === productId);
    if (!product) return;

    if (type === 'out' && product.quantity < quantity) {
        showNotification(`Estoque insuficiente! Disponível: ${product.quantity} unidades.`, 'warning');
        return;
    }

    // Atualizar quantidade do produto
    if (type === 'in') {
        product.quantity += quantity;
    } else {
        product.quantity -= quantity;
    }

    const today = new Date().toISOString().split('T')[0];
    const movementId = getID();

    // Registrar movimentação de estoque
    db.stockMovements.push({
        id: movementId,
        productId,
        productName: product.name,
        type,
        quantity,
        reason,
        date: today,
        notes
    });

    // ==========================================
    // INTEGRAÇÃO FINANCEIRA AUTOMÁTICA
    // Compra → Despesa | Venda → Receita | Perda → Despesa
    // ==========================================
    const totalAmount = quantity * product.unitPrice;

    if (reason === 'compra') {
        // Compra de produto = DESPESA no financeiro
        db.transactions.push({
            id: getID(),
            date: today,
            description: `Compra: ${quantity}x ${product.name}`,
            amount: totalAmount,
            type: 'expense',
            category: 'Estoque - Compra',
            proName: null,
            proId: null,
            clientId: null,
            stockMovementId: movementId,
            productId: productId
        });
    } else if (reason === 'venda') {
        // Venda de produto = RECEITA no financeiro
        db.transactions.push({
            id: getID(),
            date: today,
            description: `Venda Produto: ${quantity}x ${product.name}`,
            amount: totalAmount,
            type: 'income',
            category: 'Estoque - Venda',
            proName: null,
            proId: null,
            clientId: null,
            commission: 0,
            stockMovementId: movementId,
            productId: productId
        });
    } else if (reason === 'perda') {
        // Perda/Avaria = DESPESA (prejuízo) no financeiro
        db.transactions.push({
            id: getID(),
            date: today,
            description: `Perda/Avaria: ${quantity}x ${product.name}`,
            amount: totalAmount,
            type: 'expense',
            category: 'Estoque - Perda',
            proName: null,
            proId: null,
            clientId: null,
            stockMovementId: movementId,
            productId: productId
        });
    }

    save();
    closeModal('stockMovementModal');
    renderInventory();

    const actionText = type === 'in' ? 'Entrada' : 'Saída';
    showNotification(`${actionText} de ${quantity}x ${product.name} registrada!`, 'success');

    // Notificação de lançamento financeiro
    if (reason === 'compra' || reason === 'venda' || reason === 'perda') {
        const finType = reason === 'venda' ? 'Receita' : 'Despesa';
        setTimeout(() => {
            showNotification(`💰 ${finType} de ${fmtMoney(totalAmount)} registrada no Financeiro (${MOVEMENT_REASONS[reason]})`, 'info');
        }, 800);
    }

    // Alerta de estoque baixo
    if (product.quantity <= product.minQuantity && product.quantity > 0) {
        setTimeout(() => {
            showNotification(`⚠️ Atenção: "${product.name}" está com estoque baixo (${product.quantity} un)!`, 'warning');
        }, 2000);
    } else if (product.quantity <= 0) {
        setTimeout(() => {
            showNotification(`🔴 ALERTA: "${product.name}" esgotou!`, 'warning');
        }, 2000);
    }
}


