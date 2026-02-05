/**
 * Plena Bot - Automação Centralizada de Atendimento
 * Versão: 1.0.0
 * 
 * Funcionalidades:
 * - Injeção automática de HTML/CSS
 * - Persistência de sessão (localStorage)
 * - Identificação contextual da página
 * - Transbordo inteligente para WhatsApp
 */

(function () {
    // Configurações
    const CONFIG = {
        companyName: 'Plena Informática',
        whatsappPhone: '5512981488505',
        themeColor: '#ea580c', // Orange-600
        themeColorLight: '#f97316', // Orange-500
        avatar: '🤖'
    };

    // Estado da Sessão
    let state = {
        name: localStorage.getItem('plena_bot_name') || '',
        step: 'init', // init, waiting_name, done
        topic: document.title, // Tópico inicial baseado na página
        buffer: ''
    };

    // Templates de CSS
    const styles = `
        #plena-bot-widget {
            font-family: 'Inter', sans-serif;
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 9999;
        }
        .pb-toggle {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${CONFIG.themeColor} 0%, ${CONFIG.themeColorLight} 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(234, 88, 12, 0.4);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .pb-toggle:hover { transform: scale(1.1) rotate(5deg); }
        .pb-toggle svg { width: 30px; height: 30px; }
        
        .pb-window {
            width: 350px;
            max-width: 90vw;
            height: 500px;
            max-height: 80vh;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            position: absolute;
            bottom: 80px;
            left: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s ease;
            transform-origin: bottom left;
        }
        .pb-window.open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }

        .pb-header {
            background: linear-gradient(135deg, ${CONFIG.themeColor} 0%, ${CONFIG.themeColorLight} 100%);
            padding: 16px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .pb-title { font-weight: bold; font-size: 16px; }
        .pb-subtitle { font-size: 12px; opacity: 0.9; }
        .pb-close { background: none; border: none; color: white; cursor: pointer; opacity: 0.8; }
        .pb-close:hover { opacity: 1; }

        .pb-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .pb-msg {
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
            position: relative;
            animation: pb-fade-in 0.3s ease;
        }
        .pb-msg.bot {
            align-self: flex-start;
            background: white;
            color: #334155;
            border-bottom-left-radius: 2px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .pb-msg.user {
            align-self: flex-end;
            background: ${CONFIG.themeColorLight};
            color: white;
            border-bottom-right-radius: 2px;
            box-shadow: 0 2px 4px rgba(234, 88, 12, 0.2);
        }

        .pb-controls {
            padding: 12px;
            background: white;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 8px;
        }
        .pb-input {
            flex: 1;
            border: 1px solid #e2e8f0;
            padding: 10px;
            border-radius: 20px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        .pb-input:focus { border-color: ${CONFIG.themeColor}; }
        .pb-send {
            background: ${CONFIG.themeColor};
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        .pb-send:hover { background: #c2410c; }
        
        .pb-options {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
        }
        .pb-btn {
            background: #fff7ed;
            color: ${CONFIG.themeColor};
            border: 1px solid #ffedd5;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .pb-btn:hover { background: ${CONFIG.themeColor}; color: white; }

        @keyframes pb-fade-in {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;

    // Lógica Principal
    class PlenaBot {
        constructor() {
            this.init();
        }

        init() {
            this.injectStyles();
            this.injectHTML();
            this.bindEvents();

            // Mensagem de boas-vindas contextual
            setTimeout(() => {
                if (state.name) {
                    this.addBotMsg(`Olá novamente, ${state.name}! Como posso ajudar com ${document.title.split('-')[0].trim()} hoje?`);
                } else {
                    this.addBotMsg('Olá! Sou o assistente virtual da Plena. Como posso te ajudar hoje?');
                    this.showInitialOptions();
                }
            }, 1000);
        }

        injectStyles() {
            const style = document.createElement('style');
            style.innerHTML = styles;
            document.head.appendChild(style);
        }

        injectHTML() {
            const container = document.createElement('div');
            container.id = 'plena-bot-widget';
            container.innerHTML = `
                <div class="pb-window" id="pb-window">
                    <div class="pb-header">
                        <div>
                            <div class="pb-title">Atendimento Plena</div>
                            <div class="pb-subtitle">Online agora</div>
                        </div>
                        <button class="pb-close" id="pb-close">✕</button>
                    </div>
                    <div class="pb-messages" id="pb-messages"></div>
                    <div class="pb-controls">
                        <input type="text" class="pb-input" id="pb-input" placeholder="Digite sua mensagem...">
                        <button class="pb-send" id="pb-send">➤</button>
                    </div>
                </div>
                <div class="pb-toggle" id="pb-toggle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </div>
            `;
            document.body.appendChild(container);

            this.elements = {
                window: document.getElementById('pb-window'),
                toggle: document.getElementById('pb-toggle'),
                close: document.getElementById('pb-close'),
                input: document.getElementById('pb-input'),
                send: document.getElementById('pb-send'),
                messages: document.getElementById('pb-messages')
            };
        }

        bindEvents() {
            const toggleFn = (e) => {
                // Prevent default behaviors
                if (e) { e.preventDefault(); e.stopPropagation(); }
                this.elements.window.classList.toggle('open');
                if (this.elements.window.classList.contains('open')) {
                    this.elements.input.focus();
                }
            };

            this.elements.toggle.addEventListener('click', toggleFn);
            this.elements.close.addEventListener('click', toggleFn);

            this.elements.send.addEventListener('click', () => this.handleSend());
            this.elements.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSend();
            });
        }

        addBotMsg(text) {
            const div = document.createElement('div');
            div.className = 'pb-msg bot';
            div.innerHTML = text;
            this.elements.messages.appendChild(div);
            this.scrollToBottom();
        }

        addUserMsg(text) {
            const div = document.createElement('div');
            div.className = 'pb-msg user';
            div.textContent = text;
            this.elements.messages.appendChild(div);
            this.scrollToBottom();
        }

        addOptions(options) {
            const div = document.createElement('div');
            div.className = 'pb-options';
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'pb-btn';
                btn.textContent = opt.label;
                btn.onclick = () => this.handleOptionClick(opt);
                div.appendChild(btn);
            });
            this.elements.messages.appendChild(div);
            this.scrollToBottom();
        }

        scrollToBottom() {
            this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        }

        showInitialOptions() {
            const options = [
                { label: '📄 Currículos', value: 'Curriculos' },
                { label: '💰 Imposto de Renda', value: 'IRPF' },
                { label: '🏢 MEI', value: 'MEI' },
                { label: '🖨️ Outros Serviços', value: 'Outros' }
            ];
            this.addOptions(options);
        }

        handleOptionClick(opt) {
            this.addUserMsg(opt.label);
            state.topic = opt.value;
            state.step = 'waiting_name';

            if (state.name) {
                this.finishFlow();
            } else {
                setTimeout(() => this.addBotMsg('Ótima escolha. Para prosseguir, qual é o seu nome?'), 500);
            }
        }

        handleSend() {
            const text = this.elements.input.value.trim();
            if (!text) return;

            this.elements.input.value = '';
            this.addUserMsg(text);

            if (state.step === 'waiting_name') {
                state.name = text;
                localStorage.setItem('plena_bot_name', state.name);
                this.addBotMsg(`Prazer, ${state.name}!`);
                this.finishFlow();
            } else if (state.step === 'init') {
                state.topic = 'Assunto Geral';
                state.buffer = text;
                state.step = 'waiting_name';
                setTimeout(() => this.addBotMsg('Entendi. Para eu te encaminhar corretamente, qual seu nome?'), 600);
            } else {
                // Chat genérico após finalizado ou em fluxo livre
                state.buffer = text;
                this.finishFlow();
            }
        }

        finishFlow() {
            const link = this.generateWhatsAppLink();
            setTimeout(() => {
                this.addBotMsg('Prontinho! Clique abaixo para falar com um especialista no WhatsApp:');
                const div = document.createElement('div');
                div.innerHTML = `<a href="${link}" target="_blank" style="display:inline-block; margin-top:10px; background:#22c55e; color:white; padding:8px 16px; border-radius:20px; text-decoration:none; font-weight:bold; font-size:14px;">💬 Iniciar Conversa</a>`;
                this.elements.messages.appendChild(div);
                this.scrollToBottom();
            }, 800);
        }

        generateWhatsAppLink() {
            const msg = `Olá! Me chamo *${state.name}*.\nEstou no site em *${document.title}*.\nInteresse: *${state.topic}*.\nMsg: ${state.buffer}`;
            return `https://api.whatsapp.com/send?phone=${CONFIG.whatsappPhone}&text=${encodeURIComponent(msg)}`;
        }
    }

    // Inicializa quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new PlenaBot());
    } else {
        new PlenaBot();
    }
})();
