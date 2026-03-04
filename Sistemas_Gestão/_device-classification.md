# Classificação de Dispositivos — Sistemas de Gestão Plena

> Gerado em: 2026-03-04
> Sistemas analisados: 29

---

## Definições

| Tipo | Critério | Experiência esperada |
|------|----------|----------------------|
| **MOBILE-ONLY** | Uso predominante em campo, caixa, balcão ou cozinha. Tela pequena, interação touch, acesso rápido. | Bottom navigation, FAB, bottom sheets, cards compactos |
| **MULTI-DEVICE** | Gestão administrativa, relatórios, dados complexos. Pode ser usado em tablet/desktop. | Sidebar ou top nav, tabelas, painéis laterais |

---

## Classificação dos 29 Sistemas

### MOBILE-ONLY (17 sistemas)
> Design padrão: bottom nav 4–5 abas, FAB, paleta escura, toast system

| Sistema | Segmento | Cor sugerida |
|---------|----------|--------------|
| gestao-hamburgueria ✅ | Food | Amber `#f59e0b` |
| gestao-pizzaria | Food | Red `#ef4444` |
| gestao-lanchonete | Food | Orange `#f97316` |
| gestao-barbearia | Serviços | Blue `#3b82f6` |
| gestao-beleza | Saúde | Rose `#f43f5e` |
| gestao-petshop | Saúde | Teal `#14b8a6` |
| gestao-clinica-estetica | Saúde | Purple `#a855f7` |
| gestao-lavanderia | Serviços | Cyan `#06b6d4` |
| gestao-oficina | Serviços | Zinc `#71717a` |
| gestao-academia | Saúde | Green `#22c55e` |
| gestao-farmacia | Saúde | Emerald `#10b981` |
| gestao-padaria | Food | Yellow `#eab308` |
| gestao-sorveteria | Food | Pink `#ec4899` |
| gestao-delivery | Logística | Indigo `#6366f1` |
| gestao-estacionamento | Logística | Slate `#64748b` |
| gestao-lavajato | Serviços | Sky `#0ea5e9` |
| gestao-manutencao | Serviços | Orange `#ea580c` |

### MULTI-DEVICE (12 sistemas)
> Design padrão: sidebar colapsável ou top nav, tabelas de dados, layout 2 colunas

| Sistema | Segmento | Complexidade |
|---------|----------|--------------|
| gestao-alugueis | Logística | Alta — contratos, vencimentos |
| gestao-estoque | Logística | Alta — múltiplos almoxarifados |
| gestao-financeiro | Finanças | Alta — DRE, fluxo de caixa |
| gestao-vendas | Varejo | Alta — funil, metas |
| gestao-escola | Serviços | Alta — turmas, alunos, notas |
| gestao-condominio | Logística | Alta — moradores, cobranças |
| gestao-hotel | Serviços | Alta — reservas, quartos |
| gestao-consultorio | Saúde | Alta — prontuários |
| gestao-advocacia | Serviços | Alta — processos, prazos |
| gestao-contabilidade | Finanças | Alta — lançamentos |
| gestao-supermercado | Varejo | Alta — muitos SKUs |
| gestao-distribuidora | Logística | Alta — rotas, pedidos bulk |

---

## Guia de Adaptação por Tipo

### Para MOBILE-ONLY
```
bottom-nav: 4-5 abas
fab: fixo acima do bottom-nav
sheet: bottom-sheet para criação
top-bar: logo + título + ação rápida
toast: substituir todos os alert()
modais: max-height: 85vh, overflow-y: auto
```

### Para MULTI-DEVICE
```
sidebar: colapsável, 240px, fixa em desktop
nav-item: ícone + label
main: padding-left: 240px em desktop
tabelas: overflow-x: auto em mobile
filtros: inline em desktop, accordion em mobile
```

---

## Referência Visual — hamburgueria (MOBILE-ONLY)

```
┌─────────────────────────┐
│  🍔  Dashboard     [+]  │  ← top-bar (56px)
├─────────────────────────┤
│                         │
│  [stat][stat][stat][st] │  ← stats-grid 2x2
│                         │
│  Mesas                  │
│  [M1][M2][M3][M4][M5]  │  ← tables-grid
│                         │
│  Pedidos Recentes       │
│  ┌─────────────────┐   │
│  │ #001 — Mesa 02  │   │
│  │ 5min · Preparand│   │
│  └─────────────────┘   │
│                         │
├─────────────────────────┤
│ [●Hoje][Ped][Card][Cx]  │  ← bottom-nav (64px)
│ [Conf]                  │
└─────────────────────────┘
```
