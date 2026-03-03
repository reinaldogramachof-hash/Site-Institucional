/* ==========================================
   GESTÃO BELEZA | App Core
   ========================================== */

// ── State ──────────────────────────────────
const DB_KEY = 'gestao_beleza_v1';
const getID = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
const fmtMoney = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
function sanitizeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

const defaultDB = {
    appointments: [],
    team: [{ id: 't1', name: 'Profissional Principal', commission: 50, contract: 'PJ', phone: '', startDate: '' }],
    services: [{ id: 's1', name: 'Corte Feminino', price: 80 }, { id: 's2', name: 'Escova', price: 50 }, { id: 's3', name: 'Manicure', price: 35 }],
    clients: [],
    transactions: [],
    inventory: [],
    stockMovements: [],
    settings: {
        businessName: 'Gestão Beleza',
        businessHours: '09:00 - 18:00'
    }
};
let db = JSON.parse(localStorage.getItem(DB_KEY)) || JSON.parse(JSON.stringify(defaultDB));
// Ensure new fields exist for existing users
if (!db.inventory) db.inventory = [];
if (!db.stockMovements) db.stockMovements = [];
const save = () => { localStorage.setItem(DB_KEY, JSON.stringify(db)); };

// ── Toast ──────────────────────────────────
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    const colors = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-rose-500' : 'bg-blue-500';
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
    el.className = `toast-enter pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-2xl ${colors} min-w-[300px] backdrop-blur-md z-50`;
    el.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i><span class="font-bold text-sm">${msg}</span>`;
    container.appendChild(el);
    lucide.createIcons();
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Init ────────────────────────────────────
function init() {
    // Repair transactions missing proId
    db.transactions.forEach(t => {
        if (t.apptId && (!t.proId || !t.proName)) {
            const a = db.appointments.find(x => x.id === t.apptId);
            if (a) { t.proId = a.proId; t.proName = a.proName; }
        }
    });
    save(); // Save repaired data
    lucide.createIcons(); updateDateDisplay(); router('dashboard');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('rep-start').value = today.slice(0, 8) + '01';
    document.getElementById('rep-end').value = today;
    document.getElementById('exp-date').value = today;
    document.getElementById('agenda-date').value = today;
    document.getElementById('set-name').value = db.settings.businessName || '';
    document.getElementById('set-hours').value = db.settings.businessHours || '';
}

// ── Router ──────────────────────────────────
function router(view) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hide'));
    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) {
        viewEl.classList.remove('hide');
        viewEl.classList.add('fade-in');
        if (view === 'dashboard') renderDashboard();
        if (view === 'team') renderTeam();
        if (view === 'services') renderServices();
        if (view === 'finance') renderFinance();
        if (view === 'clients') renderClients();
        if (view === 'agenda') renderAgenda();
        if (view === 'reports') generateReport();
        if (view === 'inventory') renderInventory();
        if (view === 'instructions') initManual();
    }
    document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('active-nav', 'text-white'); el.classList.add('text-slate-400'); });
    const navEl = document.getElementById(`nav-${view}`);
    if (navEl) { navEl.classList.add('active-nav', 'text-white'); navEl.classList.remove('text-slate-400'); }
    const titles = { dashboard: 'Visão Geral', agenda: 'Agenda', team: 'Profissionais', services: 'Serviços', finance: 'Financeiro', clients: 'Clientes', reports: 'Relatórios', inventory: 'Estoque', instructions: 'Manual de Uso', settings: 'Configurações' };
    document.getElementById('page-title').textContent = titles[view] || 'Gestão Beleza';
    if (window.innerWidth < 1024) document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('overlay').classList.add('hidden');
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); document.getElementById('overlay').classList.toggle('hidden'); }
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

// ── Availability ────────────────────────────
function checkAvailability(date, time, proId) { return !db.appointments.find(a => a.date === date && a.time === time && a.proId === proId && a.status !== 'canceled'); }

// ── Weekly Chart ────────────────────────────
function renderWeeklyChart(data) {
    const container = document.getElementById('mini-chart-container');
    if (!container) return;
    if (data.length < 2 || data.every(v => v === 0)) { container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-slate-600"><i data-lucide="bar-chart-2" class="w-8 h-8 mb-2 opacity-50"></i><span class="text-xs">Sem dados suficientes</span></div>'; lucide.createIcons(); return; }
    const maxVal = Math.max(...data) || 100;
    const points = data.map((val, i) => { const x = (i / (data.length - 1)) * 100; const y = 100 - ((val / maxVal) * 80); return `${x},${y}`; }).join(' ');
    const svg = `<svg viewBox="0 0 100 100" class="w-full h-full overflow-visible" preserveAspectRatio="none"><defs><linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#e11d48;stop-opacity:0.3" /><stop offset="100%" style="stop-color:#e11d48;stop-opacity:0" /></linearGradient></defs><path d="M0,100 ${points.split(' ').map((p, i) => 'L' + p).join(' ')} L100,100 Z" fill="url(#gradient)" stroke="none" /><polyline points="${points}" fill="none" stroke="#e11d48" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>${data.map((val, i) => `<circle cx="${(i / (data.length - 1)) * 100}" cy="${100 - ((val / maxVal) * 80)}" r="1.5" fill="#e11d48" />`).join('')}</svg>`;
    container.innerHTML = svg;
}

// ── Dashboard ───────────────────────────────
function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todayAppts = db.appointments.filter(a => a.date === today && a.status !== 'canceled');
    const revenueToday = db.transactions.filter(t => t.date === today && t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const commPending = db.transactions.filter(t => t.type === 'income' && !t.commissionPaid).reduce((acc, t) => acc + (t.commission || 0), 0);
    document.getElementById('dash-appt-today').textContent = todayAppts.length;
    document.getElementById('dash-rev-today').textContent = fmtMoney(revenueToday);
    document.getElementById('dash-comm-pending').textContent = fmtMoney(commPending);
    const upcoming = db.appointments.filter(a => a.date >= today && a.status === 'pending').sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time)).slice(0, 5);
    const listEl = document.getElementById('upcoming-appts');
    listEl.innerHTML = upcoming.length === 0
        ? `<div class="text-center py-8 text-slate-600 flex flex-col items-center"><i data-lucide="coffee" class="w-8 h-8 mb-2 opacity-50"></i><span class="text-xs">Tudo tranquilo por hoje</span></div>`
        : upcoming.map(appt => `
        <div class="flex items-center justify-between p-3 hover:bg-white/[0.03] rounded-xl border border-transparent hover:border-white/5 transition-colors group">
            <div class="flex items-center gap-3">
                <div class="bg-white/5 text-slate-300 p-2.5 rounded-lg text-center min-w-[55px] group-hover:bg-rose-500/10 group-hover:text-rose-300 transition-colors">
                    <span class="block font-bold text-sm text-center">${appt.time}</span>
                </div>
                <div>
                    <p class="text-sm font-bold text-white">${sanitizeHTML(appt.client)}</p>
                    <p class="text-xs text-slate-500">${fmtDate(appt.date)} • ${sanitizeHTML(appt.serviceName)}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="completeAppointment('${appt.id}')" class="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Concluir">
                    <i data-lucide="check" class="w-4 h-4"></i>
                </button>
                <div class="h-4 w-px bg-white/10 mx-1"></div>
                <button onclick="cancelAppointment('${appt.id}')" class="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" title="Cancelar">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        </div>`).join('');
    lucide.createIcons();
    const chartData = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const isoDate = d.toISOString().split('T')[0]; const rev = db.transactions.filter(t => t.date === isoDate && t.type === 'income').reduce((acc, t) => acc + t.amount, 0); chartData.push(rev); }
    renderWeeklyChart(chartData);
}

// ── Agenda ──────────────────────────────────
function cancelAppointment(id) {
    if (!confirm('Tem certeza que deseja cancelar? A transação será estornada.')) return;
    const idx = db.appointments.findIndex(a => a.id === id); if (idx === -1) return;
    const appt = db.appointments[idx]; appt.status = 'canceled';
    if (appt.transactionId) { const tIdx = db.transactions.findIndex(t => t.id === appt.transactionId); if (tIdx > -1) db.transactions.splice(tIdx, 1); }
    save(); renderDashboard(); renderAgenda(); showToast('Agendamento cancelado', 'info');
}

function completeAppointment(id) {
    const idx = db.appointments.findIndex(a => a.id === id);
    if (idx === -1) return;

    // Update appointment status
    db.appointments[idx].status = 'done';

    // Update linked transaction if exists (optional, but good for consistency)
    // In this model, transaction is created at booking but commission is only paid when 'done'

    save();
    renderDashboard();
    renderAgenda();
    renderTeam(); // Update stats
    showToast('Agendamento concluído!', 'success');
}


function changeAgendaDate(days) { const input = document.getElementById('agenda-date'); const date = new Date(input.value + 'T00:00:00'); date.setDate(date.getDate() + days); input.value = date.toISOString().split('T')[0]; renderAgenda(); }

function renderAgenda() {
    const date = document.getElementById('agenda-date').value; const headerEl = document.getElementById('agenda-header'); const bodyEl = document.getElementById('agenda-body');
    headerEl.style.gridTemplateColumns = `100px repeat(${db.team.length}, 1fr)`;
    headerEl.innerHTML = `<div class="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center flex items-center justify-center bg-surface-elevated">Horário</div>` + db.team.map(t => `<div class="p-4 text-sm font-bold text-slate-300 text-center truncate border-l border-white/5">${t.name}</div>`).join('');
    let html = '';
    for (let h = 8; h <= 20; h++) {
        const time = `${h.toString().padStart(2, '0')}:00`;
        html += `<div class="grid divide-x divide-white/5 border-b border-white/5 hover:bg-white/[0.02] transition-colors" style="grid-template-columns: 100px repeat(${db.team.length}, 1fr)">`;
        html += `<div class="p-3 text-xs font-bold text-slate-500 text-center flex items-center justify-center gap-1"><i data-lucide="clock" class="w-3 h-3 text-rose-400 opacity-50"></i>${time}</div>`;
        db.team.forEach(pro => {
            const appt = db.appointments.find(a => a.date === date && a.time === time && a.proId === pro.id && a.status !== 'canceled');
            if (appt) {
                const isDone = appt.status === 'done' || appt.status === 'concluido';
                const statusColor = isDone ? 'bg-emerald-500/10 border-emerald-500' : 'bg-rose-500/10 border-rose-500';
                const textColor = isDone ? 'text-emerald-300' : 'text-rose-300';

                html += `<div class="p-1 relative group cursor-pointer">
                    <div class="h-full w-full ${statusColor} border-l-4 rounded p-2 text-xs hover:opacity-80 transition-colors flex flex-col justify-between">
                        <div>
                            <p class="font-bold ${textColor} truncate">${sanitizeHTML(appt.client)}</p>
                            <p class="${textColor}/60 truncate">${sanitizeHTML(appt.serviceName)}</p>
                        </div>
                        <div class="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            ${!isDone ? `<button onclick="completeAppointment('${appt.id}')" class="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded" title="Concluir"><i data-lucide="check" class="w-3 h-3"></i></button>` : '<i data-lucide="check-circle" class="w-3 h-3 text-emerald-500"></i>'}
                            <button onclick="cancelAppointment('${appt.id}')" class="p-1 text-rose-400 hover:bg-rose-500/20 rounded" title="Cancelar"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                        </div>
                    </div>
                </div>`;
            } else {
                html += `<div class="p-2 cursor-pointer hover:bg-rose-500/5 transition-colors group relative" onclick="openApptModalWithContext('${date}', '${time}', '${pro.id}')"><i data-lucide="plus" class="w-4 h-4 text-rose-400 opacity-0 group-hover:opacity-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity"></i></div>`;
            }
        });
        html += `</div>`;
    }
    bodyEl.innerHTML = html; lucide.createIcons();
}

function openApptModalWithContext(date, time, proId) { document.getElementById('ap-date').value = date; document.getElementById('ap-time').value = time; document.getElementById('ap-pro').value = proId; openApptModal(); }

// ── Render Functions ────────────────────────
function renderTeam() {
    const list = document.getElementById('team-list');
    if (db.team.length === 0) {
        list.innerHTML = '<div class="col-span-full text-center py-8"><i data-lucide="users" class="w-12 h-12 mx-auto mb-4 text-slate-600"></i><p class="text-slate-500">Nenhum profissional cadastrado</p></div>';
        lucide.createIcons(); return;
    }
    list.innerHTML = db.team.map(t => {
        const servicesCount = db.appointments.filter(a => a.proId === t.id && (a.status === 'done' || a.status === 'concluido')).length;
        const pendingCommissions = db.transactions.filter(tr => {
            const isIncome = tr.type === 'income';
            const isForPro = tr.proId === t.id;
            const notPaid = !tr.commissionPaid;

            if (!isIncome || !isForPro || !notPaid) return false;

            if (tr.apptId) {
                const appt = db.appointments.find(a => a.id === tr.apptId);
                return appt && (appt.status === 'done' || appt.status === 'concluido');
            }
            return true;
        }).reduce((sum, tr) => sum + (tr.commission || 0), 0);
        const rawPhone = t.phone ? t.phone.replace(/\D/g, '') : '';
        const waLink = rawPhone ? `https://wa.me/55${rawPhone}` : null;
        return `<div class="bg-surface-card p-6 rounded-2xl border border-white/5 shadow-sm flex flex-col justify-between h-full card-hover">
            <div>
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold text-xl">${sanitizeHTML(t.name.charAt(0))}</div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-[10px] font-black bg-white/5 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider">${t.contract || 'PJ'}</span>
                        <span class="text-[10px] font-black text-rose-400 uppercase">Comissão: ${t.commission}%</span>
                    </div>
                </div>
                <h3 class="font-bold text-lg text-white mb-1">${sanitizeHTML(t.name)}</h3>
                ${t.startDate ? `<p class="text-[10px] text-slate-500 mb-4 flex items-center"><i data-lucide="calendar" class="w-3 h-3 mr-1"></i> Desde ${fmtDate(t.startDate)}</p>` : '<div class="mb-4"></div>'}
                <div class="space-y-2 mt-4">
                    <div class="flex justify-between text-sm"><span class="text-slate-500">Serviços realizados:</span><span class="font-bold text-slate-200">${servicesCount}</span></div>
                    <div class="flex justify-between text-sm"><span class="text-slate-500">Comissões pendentes:</span><span class="font-bold ${pendingCommissions > 0 ? 'text-rose-400' : 'text-slate-600'}">${fmtMoney(pendingCommissions)}</span></div>
                </div>
            </div>
            <div class="mt-6 pt-4 border-t border-white/5 flex gap-2">
                <button onclick="payCommission('${t.id}')" class="flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${pendingCommissions > 0 ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-white/5 text-slate-600 cursor-not-allowed'}" ${pendingCommissions === 0 ? 'disabled' : ''}>Pagar Comissão</button>
                <div class="flex gap-1">
                    ${waLink ? `<a href="${waLink}" target="_blank" class="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors" title="WhatsApp"><i data-lucide="message-circle" class="w-5 h-5"></i></a>` : ''}
                    <button onclick="editTeam('${t.id}')" class="p-2 text-slate-400 hover:bg-white/5 rounded-lg transition-colors" title="Editar"><i data-lucide="edit-2" class="w-5 h-5"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function renderServices() { document.getElementById('services-list').innerHTML = db.services.map(s => `<div class="bg-surface-card p-6 rounded-2xl border border-white/5 shadow-sm flex items-center justify-between hover:border-rose-500/20 transition-all"><div><h4 class="font-bold text-white">${s.name}</h4><p class="text-rose-400 font-bold mt-1 text-lg">${fmtMoney(s.price)}</p></div><button onclick="editService('${s.id}')" class="p-2 hover:bg-white/5 rounded-full transition-colors"><i data-lucide="edit" class="w-4 h-4 text-slate-500"></i></button></div>`).join(''); lucide.createIcons(); }

function renderFinance() {
    const term = (document.getElementById('search-term')?.value || '').toLowerCase();
    const filter = document.getElementById('filter-type')?.value || 'all';
    const start = document.getElementById('filter-start')?.value || '';
    const end = document.getElementById('filter-end')?.value || '';

    // Filter transactions
    let filtered = db.transactions.filter(t => {
        const matchesTerm = t.description.toLowerCase().includes(term) || (t.proName && t.proName.toLowerCase().includes(term));
        const matchesType = filter === 'all' || t.type === filter;
        const matchesDate = (!start || t.date >= start) && (!end || t.date <= end);
        return matchesTerm && matchesType && matchesDate;
    });
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Monthly summary cards
    const today = new Date();
    const monthTrans = db.transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === today.getMonth() && td.getFullYear() === today.getFullYear();
    });
    const incomeMonth = monthTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenseMonth = monthTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const commissionMonth = monthTrans.filter(t => t.type === 'income').reduce((s, t) => s + (t.commission || 0), 0);
    if (document.getElementById('fin-income')) document.getElementById('fin-income').textContent = fmtMoney(incomeMonth);
    if (document.getElementById('fin-expense')) document.getElementById('fin-expense').textContent = fmtMoney(expenseMonth);
    if (document.getElementById('fin-commission')) document.getElementById('fin-commission').textContent = fmtMoney(commissionMonth);

    // Table
    const tbody = document.getElementById('finance-list');
    const emptyEl = document.getElementById('finance-empty');
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    tbody.innerHTML = filtered.map(t => {
        const isIncome = t.type === 'income';
        return `<tr class="hover:bg-white/[0.02] border-b border-white/5 transition-colors">
            <td class="p-4 text-slate-500 text-xs font-mono whitespace-nowrap">${fmtDate(t.date)}</td>
            <td class="p-4"><div class="font-bold text-slate-200">${sanitizeHTML(t.description)}</div>${t.category ? `<div class="text-xs text-slate-500">${sanitizeHTML(t.category)}</div>` : ''}</td>
            <td class="p-4 text-slate-400">${t.proName ? sanitizeHTML(t.proName) : '-'}</td>
            <td class="p-4"><span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">${isIncome ? 'Entrada' : 'Saída'}</span></td>
            <td class="p-4 text-right font-black ${isIncome ? 'text-emerald-400' : 'text-rose-400'}">${isIncome ? '+' : '-'} ${fmtMoney(t.amount)}</td>
            <td class="p-4 text-right text-sm text-slate-500">${t.commission ? fmtMoney(t.commission) : '-'}</td>
            <td class="p-4 text-right"><button onclick="editTransaction('${t.id}')" class="text-slate-500 hover:text-rose-400 transition-colors"><i data-lucide="edit-2" class="w-4 h-4"></i></button></td>
        </tr>`;
    }).join('');
    lucide.createIcons();
}

function renderClients() {
    const list = document.getElementById('clients-list');
    if (db.clients.length === 0) {
        list.innerHTML = '<div class="col-span-full text-center py-12"><i data-lucide="users" class="w-12 h-12 mx-auto mb-4 text-slate-600"></i><p class="text-slate-500 text-sm">Nenhum cliente cadastrado</p></div>';
        lucide.createIcons(); return;
    }
    list.innerHTML = db.clients.map(c => {
        const clientAppts = db.appointments.filter(a => a.client && a.client.toLowerCase() === c.name.toLowerCase());
        const completedAppts = clientAppts.filter(a => a.status !== 'canceled');
        const totalSpent = db.transactions.filter(t => t.description && t.description.toLowerCase().includes(c.name.toLowerCase()) && t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const lastVisit = completedAppts.length > 0 ? completedAppts.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date : null;
        const rawPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
        const waLink = rawPhone ? `https://wa.me/55${rawPhone}` : null;
        return `<div class="bg-surface-card p-6 rounded-2xl border border-white/5 shadow-sm flex flex-col justify-between h-full card-hover cursor-pointer" onclick="openClientDetails('${c.id}')">
            <div>
                <div class="flex justify-between items-start mb-3">
                    <div class="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold text-xl">${sanitizeHTML(c.name.charAt(0))}</div>
                    <span class="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">${completedAppts.length} visitas</span>
                </div>
                <h3 class="font-bold text-lg text-white mb-1">${sanitizeHTML(c.name)}</h3>
                <p class="text-xs text-rose-400 flex items-center gap-1 mb-1"><i data-lucide="phone" class="w-3 h-3"></i>${c.phone || 'Sem telefone'}</p>
                ${lastVisit ? `<p class="text-[10px] text-slate-500 flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i>Última visita: ${fmtDate(lastVisit)}</p>` : ''}
            </div>
            <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span class="text-sm font-bold text-rose-400">${fmtMoney(totalSpent)}</span>
                <div class="flex gap-1" onclick="event.stopPropagation()">
                    ${waLink ? `<a href="${waLink}" target="_blank" class="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><i data-lucide="message-circle" class="w-4 h-4"></i></a>` : ''}
                    <button onclick="editClient('${c.id}')" class="p-1.5 text-slate-400 hover:bg-white/5 rounded-lg transition-colors"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function openClientDetails(clientId) {
    const c = db.clients.find(x => x.id === clientId);
    if (!c) return;

    const clientAppts = db.appointments.filter(a => a.client && a.client.toLowerCase() === c.name.toLowerCase() && a.status !== 'canceled');
    const totalSpent = db.transactions.filter(t => t.description && t.description.toLowerCase().includes(c.name.toLowerCase()) && t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const avgTicket = clientAppts.length > 0 ? totalSpent / clientAppts.length : 0;
    const lastVisit = clientAppts.length > 0 ? clientAppts.sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;
    const rawPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
    const waLink = rawPhone ? `https://wa.me/55${rawPhone}` : null;

    const recentHistory = clientAppts.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    const content = document.getElementById('client-details-content');
    content.innerHTML = `
        <div class="text-center mb-6">
            <div class="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold text-3xl mx-auto mb-3">${sanitizeHTML(c.name.charAt(0))}</div>
            <h3 class="text-xl font-bold text-white">${sanitizeHTML(c.name)}</h3>
            <div class="text-xs text-slate-500 mt-1 space-y-1">
                <p>${c.phone || 'Sem telefone'}</p>
                ${c.email ? `<p>${sanitizeHTML(c.email)}</p>` : ''}
                ${c.address ? `<p>${sanitizeHTML(c.address)}</p>` : ''}
                ${c.birth ? `<p>Nasc: ${fmtDate(c.birth)}</p>` : ''}
            </div>
            ${c.notes ? `<p class="text-xs text-slate-600 mt-2 italic px-4">${sanitizeHTML(c.notes)}</p>` : ''}
        </div>
        <div class="grid grid-cols-3 gap-3 mb-6">
            <div class="bg-rose-500/10 p-3 rounded-2xl text-center border border-rose-500/20"><p class="text-[10px] text-rose-300 uppercase font-bold mb-1">Total Gasto</p><p class="text-lg font-black text-rose-400">${fmtMoney(totalSpent)}</p></div>
            <div class="bg-blue-500/10 p-3 rounded-2xl text-center border border-blue-500/20"><p class="text-[10px] text-blue-300 uppercase font-bold mb-1">Ticket Médio</p><p class="text-lg font-black text-blue-400">${fmtMoney(avgTicket)}</p></div>
            <div class="bg-emerald-500/10 p-3 rounded-2xl text-center border border-emerald-500/20"><p class="text-[10px] text-emerald-300 uppercase font-bold mb-1">Atendimentos</p><p class="text-lg font-black text-emerald-400">${clientAppts.length}</p></div>
        </div>
        ${recentHistory.length > 0 ? `
        <div class="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
            <p class="text-xs text-slate-400 uppercase font-bold tracking-widest mb-3">Histórico Recente</p>
            <div class="space-y-2 max-h-[200px] overflow-y-auto">${recentHistory.map(a => `
                <div class="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                    <div class="flex items-center gap-2"><span class="text-xs text-slate-500 font-mono w-20">${fmtDate(a.date)}</span><span class="text-slate-300 font-medium">${sanitizeHTML(a.serviceName || '—')}</span></div>
                    <span class="text-rose-400 font-bold text-sm">${fmtMoney(a.price || 0)}</span>
                </div>`).join('')}
            </div>
        </div>` : '<div class="bg-white/5 rounded-2xl p-6 text-center border border-white/10 mb-6 text-slate-600 text-sm">Nenhum histórico disponível</div>'}
        <div class="flex gap-3">
            ${waLink ? `<a href="${waLink}" target="_blank" class="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-center transition-colors text-sm"><i data-lucide="message-circle" class="w-4 h-4 inline mr-1"></i> WhatsApp</a>` : ''}
            <button onclick="closeModal('clientDetailsModal'); editClient('${c.id}')" class="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold transition-colors text-sm"><i data-lucide="edit-2" class="w-4 h-4 inline mr-1"></i> Editar</button>
        </div>`;

    document.getElementById('clientDetailsModal').classList.remove('hidden');
    lucide.createIcons();
}

function generateReport() {
    const start = document.getElementById('rep-start').value;
    const end = document.getElementById('rep-end').value;
    if (!start || !end) { showToast('Selecione o período', 'info'); return; }

    const filteredTrans = db.transactions.filter(t => t.date >= start && t.date <= end);
    const filteredAppts = db.appointments.filter(a => a.date >= start && a.date <= end && a.status !== 'canceled');

    // Financials
    const totalRev = filteredTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExp = filteredTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    // Commission generated in the period (regardless of payment status)
    const totalComm = filteredTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + (t.commission || 0), 0);

    // Net Profit = Revenue - Expenses - Commissions
    // Note: We don't double count if commission was already paid as an expense?
    // Wait, if commission is paid, it becomes an expense transaction.
    // If we subtract 'totalExp' (including paid commissions) AND 'totalComm' (generated), we might double count.

    // Let's refine:
    // Profit = Revenue - (General Expenses + Paid Commissions) ... this is CASH basis.
    // User wants: Profit = Revenue - General Expenses - Generated Commissions (Accrual for labor).

    // To do this correctly:
    // 1. Calculate General Expenses (exclude 'comissao' category expenses? or rely on the user not to classify them as such?)
    // Actually, 'payCommission' creates an expense with category 'comissao'.
    // So 'totalExp' INCLUDES paid commissions.

    // Strategy:
    // We want Real Profit.
    // Real Profit = Revenue - Non-Labor Expenses - Generated Commissions.

    const regularExpenses = filteredTrans.filter(t => t.type === 'expense' && t.category !== 'comissao').reduce((acc, t) => acc + t.amount, 0);
    const netProfit = totalRev - regularExpenses - totalComm;

    document.getElementById('rep-total-rev').textContent = fmtMoney(totalRev);
    document.getElementById('rep-total-exp').textContent = fmtMoney(totalExp); // Keep showing total expenses (cash flow) or show adjusted? Let's show cash flow expenses for consistency with the card label.
    // But for Net Profit, use the calculated value.
    document.getElementById('rep-net-profit').textContent = fmtMoney(netProfit);

    // Top Services (by volume)
    const svcCounts = {};
    filteredAppts.forEach(a => { svcCounts[a.serviceName] = (svcCounts[a.serviceName] || 0) + 1; });
    const topServices = Object.entries(svcCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('rep-top-services').innerHTML = topServices.length ? topServices.map((s, i) => `
        <div class="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
            <div class="flex items-center gap-3">
                <span class="text-rose-400 font-black text-lg w-4">${i + 1}</span>
                <span class="text-slate-200 font-medium">${sanitizeHTML(s[0])}</span>
            </div>
            <span class="bg-rose-500/10 text-rose-300 text-xs font-bold px-2 py-1 rounded-lg">${s[1]}x</span>
        </div>`).join('') : '<p class="text-slate-500 text-center text-sm py-4">Sem dados no período</p>';

    // Top Clients (by revenue)
    const clientRev = {};
    filteredTrans.filter(t => t.type === 'income' && t.description).forEach(t => {
        // Try to extract client name from description or use description itself
        // Simple heuristic: use description as client name proxy if no structured client ID yet
        // Ideally we link to client ID, but transaction description is often "Service - ClientName"
        let name = t.description;
        if (name.includes('-')) name = name.split('-').pop().trim(); // Basic parsing attempt
        clientRev[name] = (clientRev[name] || 0) + t.amount;
    });
    const topClients = Object.entries(clientRev).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('rep-top-clients').innerHTML = topClients.length ? topClients.map((c, i) => `
        <div class="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
            <div class="flex items-center gap-3">
                <span class="text-emerald-400 font-black text-lg w-4">${i + 1}</span>
                <span class="text-slate-200 font-medium truncate max-w-[120px]">${sanitizeHTML(c[0])}</span>
            </div>
            <span class="text-emerald-400 font-bold text-sm">${fmtMoney(c[1])}</span>
        </div>`).join('') : '<p class="text-slate-500 text-center text-sm py-4">Sem dados no período</p>';
}

function generateMonthReport() {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('rep-start').value = firstDay;
    document.getElementById('rep-end').value = lastDay;
    generateReport();
}

function shareReport() {
    const start = document.getElementById('rep-start').value;
    const end = document.getElementById('rep-end').value;
    if (!start || !end) { showToast('Gere um relatório primeiro', 'info'); return; }

    const filteredTrans = db.transactions.filter(t => t.date >= start && t.date <= end);
    const totalRev = filteredTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExp = filteredTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const net = totalRev - totalExp;

    const salonName = db.settings.businessName || 'Gestão Beleza';
    let msg = `📊 *RELATÓRIO FINANCEIRO*\n💅 *${salonName.toUpperCase()}*\n📅 Período: ${fmtDate(start)} a ${fmtDate(end)}\n--------------------------------\n💰 Receita: ${fmtMoney(totalRev)}\n💸 Despesas: ${fmtMoney(totalExp)}\n--------------------------------\n💎 *LUCRO: ${fmtMoney(net)}*\n--------------------------------\n_Gerado via Gestão Beleza_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── Modal Helpers ───────────────────────────
function setupModalSelects() { const svcEl = document.getElementById('ap-service'); if (svcEl) svcEl.innerHTML = db.services.map(s => `<option value="${s.id}">${s.name} - ${fmtMoney(s.price)}</option>`).join(''); const proEl = document.getElementById('ap-pro'); if (proEl) proEl.innerHTML = db.team.map(p => `<option value="${p.id}">${p.name}</option>`).join(''); }
function openApptModal() { setupModalSelects(); document.getElementById('apptModal').classList.remove('hidden'); }
function openTeamModal(pro = null) {
    if (pro) {
        document.getElementById('tm-id').value = pro.id;
        document.getElementById('tm-name').value = pro.name;
        document.getElementById('tm-comm').value = pro.commission;
        document.getElementById('tm-contract').value = pro.contract || 'PJ';
        document.getElementById('tm-phone').value = pro.phone || '';
        document.getElementById('tm-start').value = pro.startDate || '';
    } else {
        document.getElementById('tm-id').value = '';
        document.getElementById('tm-name').value = '';
        document.getElementById('tm-comm').value = '';
        document.getElementById('tm-contract').value = 'PJ';
        document.getElementById('tm-phone').value = '';
        document.getElementById('tm-start').value = '';
    }
    document.getElementById('teamModal').classList.remove('hidden');
}
function openServiceModal() { document.getElementById('svc-id').value = ''; document.getElementById('svc-name').value = ''; document.getElementById('svc-price').value = ''; document.getElementById('serviceModal').classList.remove('hidden'); }
function openExpenseModal() {
    document.querySelector('#expenseModal form').reset();
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-type').value = 'expense';
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-modal-title').textContent = 'Lançar Movimentação';
    document.getElementById('expense-submit-btn').textContent = 'Salvar Lançamento';
    document.getElementById('expenseModal').classList.remove('hidden');
}
function editTransaction(id) {
    const t = db.transactions.find(x => x.id === id);
    if (!t) return;
    document.getElementById('exp-id').value = t.id;
    document.getElementById('exp-type').value = t.type;
    document.getElementById('exp-desc').value = t.description;
    document.getElementById('exp-amount').value = t.amount;
    document.getElementById('exp-date').value = t.date;
    document.getElementById('exp-category').value = t.category || 'outros';
    document.getElementById('expense-modal-title').textContent = 'Editar Movimentação';
    document.getElementById('expense-submit-btn').textContent = 'Atualizar Lançamento';
    document.getElementById('expenseModal').classList.remove('hidden');
}
function clearFinanceFilters() {
    document.getElementById('search-term').value = '';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-start').value = '';
    document.getElementById('filter-end').value = '';
    renderFinance();
}
function openClientModal(client = null) {
    if (client) {
        document.getElementById('cli-id').value = client.id;
        document.getElementById('cli-name').value = client.name;
        document.getElementById('cli-phone').value = client.phone || '';
        document.getElementById('cli-email').value = client.email || '';
        document.getElementById('cli-birth').value = client.birth || '';
        document.getElementById('cli-address').value = client.address || '';
        document.getElementById('cli-notes').value = client.notes || '';
    } else {
        document.getElementById('cli-id').value = '';
        document.getElementById('cli-name').value = '';
        document.getElementById('cli-phone').value = '';
        document.getElementById('cli-email').value = '';
        document.getElementById('cli-birth').value = '';
        document.getElementById('cli-address').value = '';
        document.getElementById('cli-notes').value = '';
    }
    document.getElementById('clientModal').classList.remove('hidden');
}
function openClosingModal() {
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = db.transactions.filter(t => t.date === today);
    const todayAppts = db.appointments.filter(a => a.date === today && a.status !== 'canceled');
    const income = todayTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    // Filter out commission payments from expenses to avoid double counting if we are subtracting generated commission
    const regularExpense = todayTrans.filter(t => t.type === 'expense' && t.category !== 'comissao').reduce((s, t) => s + t.amount, 0);
    const totalExpense = todayTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); // For display
    const commission = todayTrans.filter(t => t.type === 'income').reduce((s, t) => s + (t.commission || 0), 0);

    // Net = Income - Regular Expenses - Generated Commissions
    const net = income - regularExpense - commission;

    document.getElementById('close-date').textContent = fmtDate(today);
    document.getElementById('close-services').textContent = todayAppts.length;
    document.getElementById('close-income').textContent = fmtMoney(income);
    document.getElementById('close-expense').textContent = fmtMoney(totalExpense);
    document.getElementById('close-commission').textContent = fmtMoney(commission);
    document.getElementById('close-net').textContent = fmtMoney(net);
    document.getElementById('closingModal').classList.remove('hidden');
    lucide.createIcons();
}
function shareClosing() {
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = db.transactions.filter(t => t.date === today);
    const todayAppts = db.appointments.filter(a => a.date === today && a.status !== 'canceled');
    const income = todayTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const regularExpense = todayTrans.filter(t => t.type === 'expense' && t.category !== 'comissao').reduce((s, t) => s + t.amount, 0);
    const totalExpense = todayTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const commission = todayTrans.filter(t => t.type === 'income').reduce((s, t) => s + (t.commission || 0), 0);
    const net = income - regularExpense - commission;
    const salonName = db.settings.businessName || 'Gestão Beleza';
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    let msg = `🔒 *FECHAMENTO DE CAIXA*\n💅 *${salonName.toUpperCase()}*\n📅 ${date} às ${time}\n================================\n📋 Atendimentos: ${todayAppts.length}\n💰 Receitas: ${fmtMoney(income)}\n💸 Despesas: ${fmtMoney(totalExpense)}\n🤝 Comissões: ${fmtMoney(commission)}\n================================\n💎 *LÍQUIDO: ${fmtMoney(net)}*\n================================\n_Relatório gerado pelo sistema._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function printClosing() {
    const today = new Date().toISOString().split('T')[0];
    const todayTrans = db.transactions.filter(t => t.date === today);
    const todayAppts = db.appointments.filter(a => a.date === today && a.status !== 'canceled');

    // Calculate totals
    // Calculate totals
    const income = todayTrans.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const regularExpense = todayTrans.filter(t => t.type === 'expense' && t.category !== 'comissao').reduce((s, t) => s + t.amount, 0);
    const totalExpense = todayTrans.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const commission = todayTrans.filter(t => t.type === 'income').reduce((s, t) => s + (t.commission || 0), 0);
    const net = income - regularExpense - commission;

    const salonName = db.settings.businessName || 'Gestão Beleza';
    const dateFmt = new Date().toLocaleDateString('pt-BR');
    const timeFmt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Helper for table rows
    const row = (label, val, bold = false) => `
        <tr>
            <td style="padding: 2px 0; ${bold ? 'font-weight:bold;' : ''}">${label}</td>
            <td style="padding: 2px 0; text-align: right; ${bold ? 'font-weight:bold;' : ''}">${fmtMoney(val)}</td>
        </tr>
    `;

    const html = `
        <div style="font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; border: 1px solid #000;">
            <h2 style="text-align: center; margin: 0 0 10px 0; font-size: 16px;">${salonName.toUpperCase()}</h2>
            <p style="text-align: center; margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">FECHAMENTO DE CAIXA</p>
            <p style="text-align: center; margin: 0 0 10px 0; font-size: 11px;">${dateFmt} - ${timeFmt}</p>
            
            <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>
            
            <table style="width: 100%; font-size: 12px;">
                <tr><td colspan="2" style="padding-bottom: 5px;"><strong>RESUMO</strong></td></tr>
                <tr><td>Atendimentos:</td><td style="text-align: right;">${todayAppts.length}</td></tr>
                ${row('Receita Total:', income)}
                ${row('Despesas:', totalExpense)}
                ${row('Comissões:', commission)}
                <tr><td colspan="2" style="border-bottom: 1px dashed #000; padding: 5px 0;"></td></tr>
                ${row('LUCRO LÍQUIDO:', net, true)}
            </table>
            
            <div style="border-bottom: 1px dashed #000; margin: 15px 0;"></div>
            
            <div style="text-align: center; margin-top: 30px;">
                <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></div>
                <p style="font-size: 10px; margin: 0;">RESPONSÁVEL</p>
            </div>
            
            <p style="text-align: center; font-size: 9px; margin-top: 20px;">Sistema Gestão Beleza</p>
        </div>
    `;

    // Create invisible iframe for printing
    let iframe = document.getElementById('print-frame');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-frame';
        iframe.style.position = 'absolute';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write('<html><head><title>Fechamento</title></head><body>');
    doc.write(html);
    doc.write('<script>window.print();<\/script>');
    doc.write('</body></html>');
    doc.close();
}

// ── Commission System ──────────────────────
let currentCommissionData = null;
function payCommission(proId) {
    // Only pay commission for COMPLETED appointments (status 'done' or 'concluido')
    // OR manual income transactions that are not linked to an appointment (e.g. ad-hoc service)
    const pendingTransactions = db.transactions.filter(t => {
        const isIncome = t.type === 'income';
        const isForPro = t.proId === proId;
        const notPaid = !t.commissionPaid;

        if (!isIncome || !isForPro || !notPaid) return false;

        // If linked to an appointment, check status
        if (t.apptId) {
            const appt = db.appointments.find(a => a.id === t.apptId);
            return appt && (appt.status === 'done' || appt.status === 'concluido');
        }

        // If manual transaction (no apptId), assume it's payable immediately
        return true;
    });
    if (pendingTransactions.length === 0) { showToast('Não há comissões pendentes!', 'info'); return; }
    const totalCommission = pendingTransactions.reduce((sum, t) => sum + (t.commission || 0), 0);
    const professional = db.team.find(t => t.id === proId);
    currentCommissionData = { proId, proName: professional.name, amount: totalCommission, date: new Date().toISOString().split('T')[0] };
    document.getElementById('comm-pro-name').textContent = professional.name;
    document.getElementById('comm-value').textContent = fmtMoney(totalCommission);
    document.getElementById('commissionModal').classList.remove('hidden');
    lucide.createIcons();
}
function confirmCommissionPayment() {
    if (!currentCommissionData) return;
    db.transactions.push({ id: getID(), description: `Pagamento Comissão: ${currentCommissionData.proName}`, amount: currentCommissionData.amount, date: currentCommissionData.date, type: 'expense', category: 'comissao' });
    db.transactions.forEach(t => { if (t.proId === currentCommissionData.proId && t.type === 'income' && !t.commissionPaid) { t.commissionPaid = true; t.commissionPaidDate = currentCommissionData.date; } });
    save(); renderFinance(); renderTeam(); closeModal('commissionModal');
    showToast('Comissão paga com sucesso!');
    currentCommissionData = null;
}
function shareCommissionWhatsApp() {
    if (!currentCommissionData) return;
    const salonName = db.settings.businessName || 'Gestão Beleza';
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    let msg = `🧾 *RECIBO DE COMISSÃO*\n💅 *${salonName.toUpperCase()}*\n📅 Data: ${date} às ${time}\n--------------------------------\n👤 *Profissional:* ${currentCommissionData.proName}\n💰 *Valor Pago:* ${fmtMoney(currentCommissionData.amount)}\n--------------------------------\n✅ *PAGAMENTO REALIZADO*\n_Comprovante digital gerado pelo sistema._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function printCommissionReceipt() {
    if (!currentCommissionData) return;

    const salonName = db.settings.businessName || 'Gestão Beleza';
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
            
            <p style="text-align: center; font-size: 9px; margin-top: 15px; color: #666;">Sistema Gestão Beleza</p>
        </div>
    `;

    const win = window.open('', '', 'width=400,height=600');
    win.document.write('<html><head><title>Recibo de Comissão</title></head><body>');
    win.document.write(createReceiptBlock('VIA DO PROFISSIONAL'));
    win.document.write('<div style="border-bottom: 1px dotted #000; margin: 20px 0;"></div>'); // Cut line
    win.document.write(createReceiptBlock('VIA DO ESTABELECIMENTO'));
    win.document.write('<script>window.print(); setTimeout(() => window.close(), 500);<\/script>');
    win.document.write('</body></html>');
    win.document.close();
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── Form Submissions ────────────────────────
function submitAppt(e) {
    e.preventDefault();
    const client = document.getElementById('ap-client').value, sId = document.getElementById('ap-service').value, pId = document.getElementById('ap-pro').value, date = document.getElementById('ap-date').value, time = document.getElementById('ap-time').value;
    if (!checkAvailability(date, time, pId)) { showToast('Horário indisponível para este profissional!', 'error'); return; }
    if (!db.clients.find(c => c.name.toLowerCase() === client.toLowerCase())) db.clients.push({ id: getID(), name: client, phone: '', notes: 'Novo cliente' });
    const s = db.services.find(x => x.id === sId), p = db.team.find(x => x.id === pId);
    const apptId = getID(), transId = getID();
    const appt = { id: apptId, client, serviceId: sId, serviceName: s.name, proId: pId, proName: p.name, date, time, price: s.price, status: 'pending', commission: s.price * (p.commission / 100), transactionId: transId };
    const trans = { id: transId, date, description: `Serviço: ${s.name} (${client})`, type: 'income', amount: s.price, commission: appt.commission, commissionPaid: false, apptId: apptId, proId: pId, proName: p.name };
    db.appointments.push(appt); db.transactions.push(trans);
    save(); closeModal('apptModal'); renderDashboard(); renderAgenda(); e.target.reset(); showToast('Agendamento confirmado!');
}

function submitTeam(e) {
    e.preventDefault();
    const id = document.getElementById('tm-id').value;
    const name = document.getElementById('tm-name').value;
    const comm = parseFloat(document.getElementById('tm-comm').value);
    const contract = document.getElementById('tm-contract').value;
    const phone = document.getElementById('tm-phone').value;
    const startDate = document.getElementById('tm-start').value;
    if (id) {
        const t = db.team.find(x => x.id === id);
        if (t) { t.name = name; t.commission = comm; t.contract = contract; t.phone = phone; t.startDate = startDate; }
        showToast('Profissional atualizado');
    } else {
        db.team.push({ id: getID(), name, commission: comm, contract, phone, startDate });
        showToast('Profissional adicionado');
    }
    save(); closeModal('teamModal'); renderTeam(); setupModalSelects();
}

function submitService(e) { e.preventDefault(); const id = document.getElementById('svc-id').value, name = document.getElementById('svc-name').value, price = parseFloat(document.getElementById('svc-price').value); if (id) { const s = db.services.find(x => x.id === id); if (s) { s.name = name; s.price = price; } showToast('Serviço atualizado'); } else { db.services.push({ id: getID(), name, price }); showToast('Serviço criado'); } save(); closeModal('serviceModal'); renderServices(); setupModalSelects(); }

function submitExpense(e) {
    e.preventDefault();
    const id = document.getElementById('exp-id').value;
    const type = document.getElementById('exp-type').value;
    const desc = document.getElementById('exp-desc').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const date = document.getElementById('exp-date').value;
    const category = document.getElementById('exp-category').value;
    if (id) {
        const t = db.transactions.find(x => x.id === id);
        if (t) { t.type = type; t.description = desc; t.amount = amount; t.date = date; t.category = category; }
        showToast('Lançamento atualizado');
    } else {
        db.transactions.push({ id: getID(), date, description: desc, type, amount, category });
        showToast(type === 'income' ? 'Receita lançada!' : 'Despesa lançada!', type === 'income' ? 'success' : 'error');
    }
    save(); closeModal('expenseModal'); renderFinance(); renderDashboard();
}

function submitClient(e) {
    e.preventDefault();
    const id = document.getElementById('cli-id').value;
    const name = document.getElementById('cli-name').value;
    const phone = document.getElementById('cli-phone').value;
    const email = document.getElementById('cli-email').value;
    const birth = document.getElementById('cli-birth').value;
    const address = document.getElementById('cli-address').value;
    const notes = document.getElementById('cli-notes').value;
    if (id) {
        const c = db.clients.find(x => x.id === id);
        if (c) { c.name = name; c.phone = phone; c.email = email; c.birth = birth; c.address = address; c.notes = notes; }
        showToast('Cliente atualizado');
    } else {
        db.clients.push({ id: getID(), name, phone, email, birth, address, notes });
        showToast('Cliente cadastrado');
    }
    save(); closeModal('clientModal'); renderClients();
}

function saveSettings(e) { e.preventDefault(); db.settings.businessName = document.getElementById('set-name').value; db.settings.businessHours = document.getElementById('set-hours').value; save(); showToast('Configurações salvas'); }

// ── Edit Functions ──────────────────────────
function editTeam(id) { const t = db.team.find(x => x.id === id); if (t) openTeamModal(t); }
function editService(id) { const s = db.services.find(x => x.id === id); document.getElementById('svc-id').value = s.id; document.getElementById('svc-name').value = s.name; document.getElementById('svc-price').value = s.price; document.getElementById('serviceModal').classList.remove('hidden'); }
function editClient(id) { const c = db.clients.find(x => x.id === id); if (c) openClientModal(c); }

// ── Backup / Restore / Reset ────────────────
function downloadBackup() { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)); const a = document.createElement('a'); a.href = dataStr; a.download = "gestao_beleza_backup.json"; document.body.appendChild(a); a.click(); a.remove(); showToast('Backup realizado!'); }
function restoreBackup(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function (e) { try { const data = JSON.parse(e.target.result); if (data.appointments && data.team) { db = data; save(); init(); showToast('Dados restaurados com sucesso!'); } else { showToast('Arquivo inválido!', 'error'); } } catch (err) { showToast('Erro ao ler arquivo', 'error'); } }; reader.readAsText(file); }
function resetSystem() { if (confirm('Tem certeza? Todos os dados serão apagados.')) { localStorage.removeItem(DB_KEY); location.reload(); } }

// ══════════════════════════════════════════════
// MÓDULO DE ESTOQUE
// ══════════════════════════════════════════════

function renderInventory() {
    // Summary cards
    const totalProducts = db.inventory.length;
    const totalValue = db.inventory.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const lowStock = db.inventory.filter(p => p.quantity <= (p.minStock || 5)).length;

    document.getElementById('inv-total-products').textContent = totalProducts;
    document.getElementById('inv-total-value').textContent = fmtMoney(totalValue);
    document.getElementById('inv-low-stock').textContent = lowStock;

    // Product grid
    const grid = document.getElementById('inventory-grid');
    if (db.inventory.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-600"><i data-lucide="package-open" class="w-12 h-12 mx-auto mb-3 opacity-40"></i><p class="text-sm font-medium">Nenhum produto cadastrado</p><p class="text-xs mt-1 text-slate-700">Clique em "Novo Produto" para começar</p></div>`;
    } else {
        grid.innerHTML = db.inventory.map(p => {
            const stockStatus = p.quantity <= 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : p.quantity <= (p.minStock || 5) ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            const stockLabel = p.quantity <= 0 ? 'Esgotado' : p.quantity <= (p.minStock || 5) ? 'Baixo' : 'Normal';
            return `<div class="bg-surface-card p-5 rounded-2xl border border-white/5 hover:border-rose-500/20 transition-all card-hover">
                <div class="flex items-start justify-between mb-3">
                    <div class="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center"><i data-lucide="package" class="w-5 h-5 text-rose-400"></i></div>
                    <span class="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${stockStatus}">${stockLabel}</span>
                </div>
                <h4 class="font-bold text-white text-sm mb-1">${p.name}</h4>
                <p class="text-xs text-slate-500 mb-3">${p.category || 'Sem categoria'}</p>
                <div class="flex items-center justify-between pt-3 border-t border-white/5">
                    <div><span class="text-lg font-black text-white">${p.quantity}</span><span class="text-xs text-slate-500 ml-1">un.</span></div>
                    <span class="text-rose-400 font-bold text-sm">${fmtMoney(p.price)}</span>
                </div>
                <div class="flex gap-2 mt-3">
                    <button onclick="editProduct('${p.id}')" class="flex-1 py-2 text-xs font-bold rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 transition-colors">Editar</button>
                    <button onclick="openMovementModal('${p.id}')" class="flex-1 py-2 text-xs font-bold rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors">Movimentar</button>
                </div>
            </div>`;
        }).join('');
    }

    // Movements history
    const movList = document.getElementById('stock-movements-list');
    const recentMov = [...db.stockMovements].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
    if (recentMov.length === 0) {
        movList.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-600 text-sm">Sem movimentações registradas</td></tr>`;
    } else {
        movList.innerHTML = recentMov.map(m => {
            const product = db.inventory.find(p => p.id === m.productId);
            return `<tr class="hover:bg-white/[0.02] transition-colors">
                <td class="p-3 text-xs text-slate-500 font-mono">${fmtDate(m.date)}</td>
                <td class="p-3 text-sm font-bold text-slate-200">${product ? product.name : 'Produto removido'}</td>
                <td class="p-3"><span class="px-2 py-1 rounded-lg text-[10px] font-black uppercase ${m.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">${m.type === 'in' ? 'Entrada' : 'Saída'}</span></td>
                <td class="p-3 text-center font-bold ${m.type === 'in' ? 'text-emerald-400' : 'text-rose-400'}">${m.type === 'in' ? '+' : '-'}${m.quantity}</td>
                <td class="p-3 text-xs text-slate-500">${m.reason || ''}</td>
            </tr>`;
        }).join('');
    }
    lucide.createIcons();
}

// Product CRUD
function openProductModal() {
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-category').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-quantity').value = '';
    document.getElementById('prod-min-stock').value = '5';
    document.getElementById('productModal').classList.remove('hidden');
}

function editProduct(id) {
    const p = db.inventory.find(x => x.id === id);
    if (!p) return;
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-category').value = p.category || '';
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-quantity').value = p.quantity;
    document.getElementById('prod-min-stock').value = p.minStock || 5;
    document.getElementById('productModal').classList.remove('hidden');
}

function submitProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const category = document.getElementById('prod-category').value;
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const quantity = parseInt(document.getElementById('prod-quantity').value) || 0;
    const minStock = parseInt(document.getElementById('prod-min-stock').value) || 5;

    if (id) {
        const p = db.inventory.find(x => x.id === id);
        if (p) { p.name = name; p.category = category; p.price = price; p.quantity = quantity; p.minStock = minStock; }
        showToast('Produto atualizado');
    } else {
        db.inventory.push({ id: getID(), name, category, price, quantity, minStock });
        showToast('Produto cadastrado');
    }
    save(); closeModal('productModal'); renderInventory();
}

// Stock movements
function openMovementModal(productId) {
    document.getElementById('mov-product').value = productId || '';
    document.getElementById('mov-type').value = 'in';
    document.getElementById('mov-quantity').value = '';
    document.getElementById('mov-reason').value = 'Compra';
    document.getElementById('mov-notes').value = '';

    // Populate product select
    const sel = document.getElementById('mov-product');
    sel.innerHTML = db.inventory.map(p => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${p.name} (${p.quantity} un.)</option>`).join('');

    document.getElementById('movementModal').classList.remove('hidden');
}

function submitStockMovement(e) {
    e.preventDefault();
    const productId = document.getElementById('mov-product').value;
    const type = document.getElementById('mov-type').value;
    const quantity = parseInt(document.getElementById('mov-quantity').value) || 0;
    const reason = document.getElementById('mov-reason').value;
    const notes = document.getElementById('mov-notes').value.trim();

    if (!productId) { showToast('Selecione um produto!', 'error'); return; }
    if (quantity <= 0) { showToast('Quantidade deve ser maior que zero!', 'error'); return; }

    const product = db.inventory.find(p => p.id === productId);
    if (!product) return;

    if (type === 'out' && product.quantity < quantity) {
        showToast(`Estoque insuficiente! Disponível: ${product.quantity} un.`, 'error');
        return;
    }

    // Update quantity
    if (type === 'in') { product.quantity += quantity; } else { product.quantity -= quantity; }

    const today = new Date().toISOString().split('T')[0];
    const movementId = getID();

    db.stockMovements.push({ id: movementId, productId, type, quantity, reason, notes, date: today });

    // Financial integration
    if (reason === 'Compra') {
        db.transactions.push({ id: getID(), date: today, description: `Compra Estoque: ${product.name} (${quantity}x)`, type: 'expense', amount: product.price * quantity, stockMovementId: movementId });
    } else if (reason === 'Venda') {
        db.transactions.push({ id: getID(), date: today, description: `Venda Produto: ${product.name} (${quantity}x)`, type: 'income', amount: product.price * quantity, stockMovementId: movementId });
    } else if (reason === 'Perda') {
        db.transactions.push({ id: getID(), date: today, description: `Perda Estoque: ${product.name} (${quantity}x)`, type: 'expense', amount: product.price * quantity, stockMovementId: movementId });
    }

    // Low stock alert
    if (product.quantity <= (product.minStock || 5) && product.quantity > 0) {
        showToast(`⚠️ ${product.name}: estoque baixo (${product.quantity} un.)`, 'info');
    } else if (product.quantity <= 0) {
        showToast(`🚨 ${product.name}: estoque esgotado!`, 'error');
    } else {
        showToast('Movimentação registrada!');
    }

    save(); closeModal('movementModal'); renderInventory();
}

// ══════════════════════════════════════════════
// MÓDULO DE MANUAL DE USO
// ══════════════════════════════════════════════

function initManual() {
    lucide.createIcons();
    // Setup accordion behavior
    document.querySelectorAll('.manual-section .manual-header').forEach(header => {
        header.onclick = () => {
            const section = header.closest('.manual-section');
            section.classList.toggle('open');
        };
    });
}

// ── Boot ────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
