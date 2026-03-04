# Design System — Plena Sistemas de Gestão

> Versão: 1.0 — 2026-03-04
> Sistema de referência: gestao-hamburgueria (amber)

---

## 1. Filosofia

- **Dark-first**: fundo escuro (#0c0a09), superfície escura, texto claro
- **Mobile-first**: touch targets ≥44px, bottom navigation, bottom sheets
- **CSS nativo**: sem frameworks externos. CSS custom properties + vanilla JS
- **Um arquivo**: todo o sistema em um único `index.html` autocontido

---

## 2. Paletas por Nicho

Cada sistema tem uma cor primária (`--c-primary`) que define a identidade visual.
O restante das tokens é **idêntico** em todos os sistemas.

| Nicho | Sistema | Primary | Primary Dark | Primary Light |
|-------|---------|---------|--------------|---------------|
| Hamburguer | gestao-hamburgueria | `#f59e0b` | `#d97706` | `#fbbf24` |
| Pizzaria | gestao-pizzaria | `#ef4444` | `#dc2626` | `#f87171` |
| Lanchonete | gestao-lanchonete | `#f97316` | `#ea580c` | `#fb923c` |
| Barbearia | gestao-barbearia | `#3b82f6` | `#2563eb` | `#60a5fa` |
| Beleza | gestao-beleza | `#f43f5e` | `#e11d48` | `#fb7185` |
| Pet Shop | gestao-petshop | `#14b8a6` | `#0d9488` | `#2dd4bf` |
| Estética | gestao-clinica-estetica | `#a855f7` | `#9333ea` | `#c084fc` |
| Academia | gestao-academia | `#22c55e` | `#16a34a` | `#4ade80` |
| Padaria | gestao-padaria | `#eab308` | `#ca8a04` | `#facc15` |
| Sorveteria | gestao-sorveteria | `#ec4899` | `#db2777` | `#f472b6` |
| Delivery | gestao-delivery | `#6366f1` | `#4f46e5` | `#818cf8` |
| Lavanderia | gestao-lavanderia | `#06b6d4` | `#0891b2` | `#22d3ee` |
| Oficina | gestao-oficina | `#71717a` | `#52525b` | `#a1a1aa` |
| Farmácia | gestao-farmacia | `#10b981` | `#059669` | `#34d399` |

---

## 3. Tokens Base (invariáveis)

```css
:root {
  /* Tema escuro — fixo em todos os sistemas */
  --c-bg:        #0c0a09;   /* fundo da página */
  --c-surface:   #1c1917;   /* cartões, painéis */
  --c-surface2:  #292524;   /* inputs, botões ghost */
  --c-border:    #44403c;   /* bordas, divisores */
  --c-text:      #fafaf9;   /* texto principal */
  --c-muted:     #a8a29e;   /* texto secundário */
  --c-success:   #22c55e;
  --c-danger:    #ef4444;
  --c-info:      #3b82f6;

  /* Layout */
  --nav-h:    64px;   /* altura do bottom-nav */
  --top-h:    56px;   /* altura do top-bar */
  --radius:   12px;   /* border-radius padrão */
  --radius-sm: 8px;   /* border-radius compacto */
}
```

---

## 4. Estrutura de Componentes

### 4.1 App Shell
```html
<body>
  <!-- Splash (1.5s, oculto em demo) -->
  <div id="plena-splash">...</div>

  <!-- Ativação (airlock de licença) -->
  <section id="view-login" class="hidden">...</section>

  <!-- App principal (visível após auth) -->
  <div id="app" class="app-shell">
    <header class="top-bar">...</header>
    <main class="tab-panels">
      <section id="tab-[nome]" class="tab-panel [active]">...</section>
    </main>
    <nav class="bottom-nav">...</nav>
  </div>

  <!-- Overlays (fora do #app) -->
  <button class="fab hidden" id="fab-order">...</button>
  <div id="toast-container"></div>
  <div class="sheet-overlay" id="overlay-sheet-[nome]"></div>
  <div class="bottom-sheet" id="sheet-[nome]">...</div>
  <div class="modal-overlay" id="modal-[nome]">...</div>
  <div id="welcome-receipt-modal">...</div>
</body>
```

### 4.2 Bottom Navigation (5 abas padrão)
```
[  Hoje  ] [ Pedidos ] [ Serviço ] [ Caixa ] [ Config ]
  (ativo)    (badge?)
```
- Aba 1: Dashboard / Hoje
- Aba 2: Entidade principal (pedidos, clientes, agendamentos...)
- Aba 3: Catálogo (cardápio, serviços, produtos...)
- Aba 4: Financeiro / Caixa
- Aba 5: Configurações

### 4.3 Cards de Stats
```html
<div class="stats-grid">          <!-- grid 2x2 -->
  <div class="stat-card">
    <div class="stat-card__top">
      <span class="card__label">Rótulo</span>
      <div class="card__icon" style="background:rgba(245,158,11,0.12);">🔥</div>
    </div>
    <div class="card__value" id="stat-X">0</div>
  </div>
</div>
```

### 4.4 List Items
```html
<div class="list-item">
  <div class="list-item__main">
    <div class="list-item__title">Título</div>
    <div class="list-item__sub">Subtítulo · detalhe</div>
  </div>
  <div class="list-item__right">
    <span class="badge badge--pending">Status</span>
    <div class="text-xs text-muted mt-1">R$ 0,00</div>
  </div>
</div>
```

### 4.5 Bottom Sheet
```html
<!-- Overlay -->
<div class="sheet-overlay" id="overlay-sheet-X" onclick="closeSheet('sheet-X')"></div>
<!-- Sheet -->
<div class="bottom-sheet" id="sheet-X">
  <div class="sheet-handle"></div>
  <div class="sheet-title">Título</div>
  <!-- conteúdo -->
  <button class="btn btn--primary btn--full" onclick="submitX()">Confirmar</button>
</div>
```
```js
function openSheet(id) { el('overlay-'+id).classList.add('visible'); el(id).classList.add('open'); }
function closeSheet(id) { el('overlay-'+id).classList.remove('visible'); el(id).classList.remove('open'); }
```

### 4.6 Toast System
```js
showToast('Mensagem aqui', 'success'); // success | error | warning | info
```
- Duração: 3 segundos
- Posição: acima do bottom-nav
- Substituir todos os `alert()` e `confirm()` visuais

### 4.7 FAB
```html
<button class="fab hidden" id="fab-[nome]" onclick="openSheet('sheet-[nome]')">
  <svg><!-- plus icon --></svg>
</button>
```
- Visível apenas na aba de entidades (aba 2)
- Posicionado acima do bottom-nav

---

## 5. Padrão de Dados

```js
const DB_KEY = 'gestao_[nicho]_v1';  // sempre com _v1

const defaultDB = {
  [entidades]: [],      // array principal
  settings: {
    businessName: '',
    phone: '',
    address: '',
    taxRate: 0,
    currency: 'BRL',
    termsAccepted: false,
    termsAcceptedAt: null,
    licenseKey: '',
    licenseName: '',
    activatedAt: null
  }
};
```

---

## 6. Demo Mode

```js
// Detecta ?demo na URL OU estar em iframe (tecnologia.html)
const isDemo = new URLSearchParams(location.search).has('demo');
```

Comportamento em demo:
- Splash oculto
- Lock de licença ignorado
- Badge amarelo no topo: "MODO DEMONSTRAÇÃO — Dados fictícios"
- Botão WhatsApp oculto
- Dados de demonstração pré-carregados no defaultDB

---

## 7. Sistema de Licença (lock.js pattern)

```js
function init() {
  load();
  const hasLicense = !!localStorage.getItem('plena_license');
  const hasReceipt = !!localStorage.getItem('ml_receipt_confirmed');

  if (!isDemo && !hasLicense) {
    el('view-login').classList.remove('hidden');
    return;
  }
  if (!isDemo && hasLicense && !hasReceipt) {
    el('welcome-receipt-modal').style.display = 'flex';
    return;
  }
  // App pronto
  el('app').classList.add('visible');
  router('hoje');
}
```

Master keys (apenas teste/dev): `MASTER123`, `ADMIN_ML`, `TESTE2026`

---

## 8. Checklist de Implementação por Sistema

- [ ] `<title>[Sistema] | Plena Informática</title>`
- [ ] `<meta name="theme-color" content="[primary]">`
- [ ] `<link rel="manifest" href="./manifest.json">`
- [ ] `manifest.json` com `theme_color` e `background_color` atualizados
- [ ] `icon.svg` com "P" na cor primária do nicho
- [ ] Splash screen com cor primária do nicho
- [ ] view-login com cor primária do nicho
- [ ] DB_KEY único: `gestao_[nicho]_v1`
- [ ] defaultDB com dados de demonstração realistas (mín. 5-8 itens)
- [ ] isDemo detectado e bypass de lock
- [ ] Toast system em todos os feedbacks
- [ ] Bottom nav com 5 abas mapeadas ao nicho
- [ ] FAB na aba principal de criação
- [ ] Bottom sheet para criação rápida
- [ ] Modal de termos em Config
- [ ] welcome-receipt-modal preservado
- [ ] activateLicense V12.1 preservado
- [ ] confirmReceipt preservado
- [ ] Botão WhatsApp (fora do modo demo)
- [ ] Badge de demo (no modo demo)
- [ ] Footer Plena Informática
- [ ] serviceWorker.register('./sw.js')
- [ ] Backup/restore em JSON
