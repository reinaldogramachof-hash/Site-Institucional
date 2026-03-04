<?php
/**
 * webhook_mp.php — Recebe notificações IPN/Webhook do Mercado Pago.
 *
 * O Mercado Pago envia um POST com JSON no corpo quando um
 * evento de pagamento ocorre. Este arquivo processa apenas
 * eventos do tipo 'payment' com status 'approved'.
 *
 * Sempre retorna HTTP 200 para o MP não reenviar a notificação.
 */

require_once __DIR__ . '/config.php';

// Retornar 200 imediatamente (boa prática com webhooks)
header('HTTP/1.1 200 OK');

// ─────────────────────────────────────────────
// 1. Ler e decodificar o body da requisição
// ─────────────────────────────────────────────

$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Ignorar requisições malformadas ou sem dados úteis
if (empty($data) || !is_array($data)) {
    exit;
}

// ─────────────────────────────────────────────
// 2. Verificar se é um evento de pagamento
// ─────────────────────────────────────────────

if (($data['type'] ?? '') !== 'payment') {
    exit;
}

$paymentId = $data['data']['id'] ?? '';

if (empty($paymentId)) {
    exit;
}

// ─────────────────────────────────────────────
// 3. Consultar o pagamento na API do Mercado Pago
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
curl_close($ch);

if ($httpStatus !== 200 || empty($resposta)) {
    exit;
}

$pagamento = json_decode($resposta, true);

// Só processar pagamentos aprovados
if (($pagamento['status'] ?? '') !== 'approved') {
    exit;
}

$sistema = $pagamento['external_reference'] ?? '';
$nomeSistema = ucwords(str_replace('-', ' ', $sistema));

// Validar slug do sistema
if (!preg_match('/^[a-z0-9\-]+$/', $sistema)) {
    exit;
}

// ─────────────────────────────────────────────
// 4. Verificar e inserir/atualizar licença no banco
// ─────────────────────────────────────────────

try {
    $pdo = getPDO();

    // Verificar se já existe licença para este payment_id
    $stmt = $pdo->prepare('SELECT id, status FROM licencas WHERE payment_id = ? LIMIT 1');
    $stmt->execute([$paymentId]);
    $existente = $stmt->fetch();

    if (!$existente) {
        // Criar nova licença com status 'ativo'
        $chave = gerarLicenca();

        $insert = $pdo->prepare(
            'INSERT INTO licencas
              (license_key, sistema, nome_sistema, payment_id, status, criado_em)
             VALUES (?, ?, ?, ?, ?, NOW())'
        );
        $insert->execute([$chave, $sistema, $nomeSistema, $paymentId, 'ativo']);

    } elseif ($existente['status'] === 'pendente') {
        // Atualizar licença pendente para ativo
        $update = $pdo->prepare(
            'UPDATE licencas SET status = ? WHERE payment_id = ?'
        );
        $update->execute(['ativo', $paymentId]);
    }

    // Se já estava ativo, não faz nada (idempotente)

} catch (PDOException $e) {
    error_log('[webhook_mp.php] PDOException: ' . $e->getMessage());
}

exit;
