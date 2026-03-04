<?php
/**
 * success.php — Página de confirmação pós-pagamento aprovado.
 *
 * O Mercado Pago redireciona o cliente aqui com os parâmetros:
 *   ?collection_id=...&collection_status=approved&payment_id=...
 *   &status=approved&external_reference=gestao-barbearia&payment_type=...
 *
 * Fluxo:
 *   1. Valida presença de payment_id e external_reference
 *   2. Consulta o pagamento na API do Mercado Pago
 *   3. Verifica status 'approved' e bate o external_reference
 *   4. Verifica duplicata no banco (refresh seguro)
 *   5. Gera licença e insere no banco (ou recupera existente)
 *   6. Exibe a licença e o link do sistema
 */

require_once __DIR__ . '/config.php';

// ─────────────────────────────────────────────
// 1. Validação básica dos parâmetros
// ─────────────────────────────────────────────

$paymentId = trim($_GET['payment_id'] ?? '');
$externalReference = trim($_GET['external_reference'] ?? '');

if (empty($paymentId) || empty($externalReference)) {
    header('Location: cancel.php');
    exit;
}

// Sanitiza o slug do sistema
if (!preg_match('/^[a-z0-9\-]+$/', $externalReference)) {
    header('Location: cancel.php');
    exit;
}

// ─────────────────────────────────────────────
// 2. Consultar pagamento na API do Mercado Pago
// ─────────────────────────────────────────────

$ch = curl_init('https://api.mercadopago.com/v1/payments/' . urlencode($paymentId));
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . MP_ACCESS_TOKEN,
    ],
    CURLOPT_TIMEOUT => 15,
]);

$resposta = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError || $httpStatus !== 200) {
    header('Location: cancel.php?motivo=api_error');
    exit;
}

$pagamento = json_decode($resposta, true);

// ─────────────────────────────────────────────
// 3. Verificar aprovação e external_reference
// ─────────────────────────────────────────────

$statusPagamento = $pagamento['status'] ?? '';
$refApi = $pagamento['external_reference'] ?? '';

if ($statusPagamento !== 'approved' || $refApi !== $externalReference) {
    header('Location: cancel.php?motivo=nao_aprovado');
    exit;
}

// ─────────────────────────────────────────────
// 4. Verificar duplicata por payment_id no banco
// ─────────────────────────────────────────────

try {
    $pdo = getPDO();

    $stmt = $pdo->prepare('SELECT license_key, nome_sistema FROM licencas WHERE payment_id = ? LIMIT 1');
    $stmt->execute([$paymentId]);
    $licencaExistente = $stmt->fetch();

    if ($licencaExistente) {
        // Pagamento já processado — exibir licença existente
        $chave = $licencaExistente['license_key'];
        $nomeSistema = $licencaExistente['nome_sistema'];
    } else {
        // 5. Gerar nova licença e inserir no banco
        $nomeSistema = ucwords(str_replace('-', ' ', $externalReference));
        $chave = gerarLicenca();

        $insert = $pdo->prepare(
            'INSERT INTO licencas
              (license_key, sistema, nome_sistema, payment_id, status, criado_em)
             VALUES (?, ?, ?, ?, ?, NOW())'
        );
        $insert->execute([$chave, $externalReference, $nomeSistema, $paymentId, 'ativo']);
    }

} catch (PDOException $e) {
    // Erro crítico no banco — não expõe detalhes ao usuário
    error_log('[success.php] PDOException: ' . $e->getMessage());
    header('Location: cancel.php?motivo=db_error');
    exit;
}

// ─────────────────────────────────────────────
// 6. Montar link do sistema
// ─────────────────────────────────────────────

$linkSistema = BASE_URL . '/Sistemas_Gestão/' . $externalReference . '/index.html';

?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pagamento Confirmado! | Plena Informática</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/@phosphor-icons/web"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Roboto+Mono:wght@500;700&display=swap"
        rel="stylesheet" />
    <style>
        body {
            font-family: 'Poppins', sans-serif;
            background: #0A0A0F;
        }

        .chave-licenca {
            font-family: 'Roboto Mono', monospace;
            letter-spacing: 0.15em;
        }
    </style>
</head>

<body class="min-h-screen text-gray-200">

    <!-- Header / Logo -->
    <header class="border-b border-white/5 py-4 px-6">
        <a href="index.html" class="inline-flex items-center gap-2">
            <img src="logo-plena.png" alt="Plena Informática" class="h-12 w-auto object-contain" />
        </a>
    </header>

    <main class="max-w-2xl mx-auto px-4 py-12">

        <!-- Ícone de sucesso -->
        <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-24 h-24
                  rounded-full bg-emerald-900/40 border-2 border-emerald-500/60 mb-4">
                <i class="ph ph-check-circle text-5xl text-emerald-400"></i>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold text-white mb-2">
                Pagamento Confirmado! 🎉
            </h1>
            <p class="text-gray-400 text-base">
                Seu sistema <strong class="text-emerald-400">
                    <?= htmlspecialchars($nomeSistema) ?>
                </strong>
                está pronto para ativar.
            </p>
        </div>

        <!-- Box da licença -->
        <div class="bg-black/40 border border-emerald-700/40 rounded-2xl p-6 mb-4 text-center">
            <p class="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
                Sua Chave de Licença:
            </p>
            <div id="chave-display" class="chave-licenca text-2xl md:text-3xl font-bold text-emerald-300 bg-black/30
                  border border-emerald-800/50 rounded-xl px-6 py-4 mb-4 select-all">
                <?= htmlspecialchars($chave) ?>
            </div>
            <button onclick="copiarChave()" id="btn-copiar" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500
                     text-black font-bold px-5 py-2 rounded-xl transition-colors text-sm">
                <i class="ph ph-copy text-base"></i>
                Copiar Chave
            </button>
            <p id="msg-copiado" class="text-emerald-400 text-xs mt-2 hidden">✓ Chave copiada!</p>
        </div>

        <!-- Box com link do sistema -->
        <div class="bg-black/40 border border-white/10 rounded-2xl p-6 mb-6">
            <p class="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
                Link do Sistema:
            </p>
            <a href="<?= htmlspecialchars($linkSistema) ?>" target="_blank"
                class="block text-emerald-400 text-sm break-all hover:underline mb-4 font-mono">
                <?= htmlspecialchars($linkSistema) ?>
            </a>
            <a href="<?= htmlspecialchars($linkSistema) ?>" target="_blank" class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500
                text-black font-bold px-6 py-3 rounded-xl transition-colors">
                <i class="ph ph-arrow-square-out text-lg"></i>
                Acessar Sistema Agora →
            </a>
        </div>

        <!-- Instruções em 3 passos -->
        <div class="bg-black/40 border border-white/10 rounded-2xl p-6 mb-6">
            <h2 class="font-bold text-white text-base mb-4">Como ativar:</h2>
            <ol class="space-y-3 text-sm text-gray-300">
                <li class="flex gap-3 items-start">
                    <span class="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-900/60 border border-emerald-700/50
                       flex items-center justify-center text-emerald-400 font-bold text-xs">1</span>
                    Clique em <strong>"Acessar Sistema Agora"</strong> acima.
                </li>
                <li class="flex gap-3 items-start">
                    <span class="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-900/60 border border-emerald-700/50
                       flex items-center justify-center text-emerald-400 font-bold text-xs">2</span>
                    Insira seu <strong>e-mail</strong> e a <strong>chave de licença</strong> acima quando solicitado.
                </li>
                <li class="flex gap-3 items-start">
                    <span class="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-900/60 border border-emerald-700/50
                       flex items-center justify-center text-emerald-400 font-bold text-xs">3</span>
                    Confirme o recibo no sistema para liberar o acesso completo.
                </li>
            </ol>
        </div>

        <!-- Rodapé / navegação -->
        <div class="text-center">
            <a href="tecnologia.html" class="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm
                border border-white/10 hover:border-white/20 rounded-xl px-5 py-2.5 transition-colors mb-4">
                <i class="ph ph-house text-base"></i>
                Voltar ao início
            </a>
            <p class="text-gray-600 text-xs mt-2">
                Em caso de dúvidas, entre em contato via WhatsApp:
                <a href="https://wa.me/5512992191018" class="text-emerald-400 hover:underline" target="_blank">
                    (12) 99219-1018
                </a>
            </p>
        </div>

    </main>

    <script>
        function copiarChave() {
            const chave = document.getElementById('chave-display').textContent.trim();
            navigator.clipboard.writeText(chave).then(() => {
                const btn = document.getElementById('btn-copiar');
                const msg = document.getElementById('msg-copiado');
                btn.innerHTML = '<i class="ph ph-check text-base"></i> Copiado!';
                msg.classList.remove('hidden');
                setTimeout(() => {
                    btn.innerHTML = '<i class="ph ph-copy text-base"></i> Copiar Chave';
                    msg.classList.add('hidden');
                }, 2500);
            }).catch(() => {
                // Fallback para navegadores sem suporte à Clipboard API
                const range = document.createRange();
                range.selectNode(document.getElementById('chave-display'));
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                document.execCommand('copy');
                window.getSelection().removeAllRanges();
                document.getElementById('msg-copiado').classList.remove('hidden');
            });
        }
    </script>

</body>

</html>