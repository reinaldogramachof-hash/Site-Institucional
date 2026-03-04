<?php
/**
 * checkout.php — Cria a preferência de pagamento no Mercado Pago
 * e redireciona o cliente para o checkout oficial.
 *
 * Parâmetros GET esperados:
 *   ?sistema=gestao-barbearia&nome=Gest%C3%A3o+Barbearia
 */

require_once __DIR__ . '/config.php';

// ─────────────────────────────────────────────
// 1. Validação dos parâmetros de entrada
// ─────────────────────────────────────────────

$sistema = trim($_GET['sistema'] ?? '');
$nomeSistema = trim($_GET['nome'] ?? $sistema);

// Só permite letras, números e hífens no slug
if (!preg_match('/^[a-z0-9\-]+$/', $sistema)) {
    exibirErro('Parâmetro de sistema inválido.');
}

if (empty($nomeSistema)) {
    $nomeSistema = ucwords(str_replace('-', ' ', $sistema));
}

// ─────────────────────────────────────────────
// 2. Construir payload da preferência
// ─────────────────────────────────────────────

$preferencia = [
    'items' => [
        [
            'title' => $nomeSistema,
            'quantity' => 1,
            'unit_price' => (float) PRECO_SISTEMA,
            'currency_id' => 'BRL',
        ]
    ],
    'back_urls' => [
        'success' => BASE_URL . '/success.php',
        'failure' => BASE_URL . '/cancel.php',
        'pending' => BASE_URL . '/cancel.php',
    ],
    'auto_return' => 'approved',
    'notification_url' => BASE_URL . '/webhook_mp.php',
    'external_reference' => $sistema,
    'statement_descriptor' => 'Plena Informatica',
];

// ─────────────────────────────────────────────
// 3. Requisição cURL → Mercado Pago
// ─────────────────────────────────────────────

$ch = curl_init('https://api.mercadopago.com/checkout/preferences');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($preferencia),
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . MP_ACCESS_TOKEN,
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT => 15,
]);

$resposta = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    exibirErro('Falha de conexão com o Mercado Pago. Tente novamente em instantes.');
}

// ─────────────────────────────────────────────
// 4. Processar resposta e redirecionar
// ─────────────────────────────────────────────

$dados = json_decode($resposta, true);

if ($httpStatus >= 200 && $httpStatus < 300) {
    // Usa o init_point de produção; fallback para sandbox
    $urlCheckout = $dados['init_point'] ?? ($dados['sandbox_init_point'] ?? null);

    if ($urlCheckout) {
        header('Location: ' . $urlCheckout);
        exit;
    }
}

// Erro retornado pela API
$mensagemApi = $dados['message'] ?? 'Erro desconhecido na API do Mercado Pago.';
exibirErro(htmlspecialchars($mensagemApi));

// ─────────────────────────────────────────────
// Função auxiliar — exibe página de erro amigável
// ─────────────────────────────────────────────

function exibirErro(string $mensagem): void
{
    http_response_code(500);
    ?>
    <!DOCTYPE html>
    <html lang="pt-BR">

    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Erro no Checkout | Plena Informática</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/@phosphor-icons/web"></script>
        <style>
            body {
                font-family: 'Segoe UI', sans-serif;
                background: #0A0A0F;
            }
        </style>
    </head>

    <body class="min-h-screen flex items-center justify-center px-4">
        <div class="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <i class="ph ph-warning-circle text-6xl text-red-400 mb-4 block"></i>
            <h1 class="text-2xl font-bold text-white mb-3">Ops! Algo deu errado.</h1>
            <p class="text-gray-400 text-sm mb-2">Não foi possível iniciar o pagamento.</p>
            <p class="text-red-300 text-xs bg-red-900/30 border border-red-700/30 rounded-lg px-4 py-2 mb-6">
                <?= $mensagem ?>
            </p>
            <a href="tecnologia.html#sistemas"
                class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold px-6 py-3 rounded-xl transition-colors">
                <i class="ph ph-arrow-left"></i> Voltar aos sistemas
            </a>
            <p class="text-gray-500 text-xs mt-4">
                Precisa de ajuda?
                <a href="https://wa.me/5512992191018" class="text-emerald-400 hover:underline" target="_blank">
                    WhatsApp: (12) 99219-1018
                </a>
            </p>
        </div>
    </body>

    </html>
    <?php
    exit;
}
