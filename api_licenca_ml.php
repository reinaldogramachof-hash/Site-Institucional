<?php
/**
 * api_licenca_ml.php — API de validação e ativação de licenças.
 *
 * Referenciado por todos os sistemas PWA como ../api_licenca_ml.php
 *
 * Actions disponíveis (via GET ?action=... ou JSON body):
 *   - activate        → Ativa a licença no dispositivo
 *   - confirm_receipt → Marca o recibo como confirmado
 */

// ─────────────────────────────────────────────
// Headers obrigatórios (CORS + JSON)
// ─────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/config.php';

// ─────────────────────────────────────────────
// Ler action e body
// ─────────────────────────────────────────────

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? ($body['action'] ?? '');

// ─────────────────────────────────────────────
// Roteamento por action
// ─────────────────────────────────────────────

try {

    switch ($action) {

        // ══════════════════════════════════════
        // ACTION: activate
        // Ativa a licença vinculando ao device_id
        // ══════════════════════════════════════
        case 'activate':
            $licenseKey = trim($body['license_key'] ?? $_GET['license_key'] ?? '');
            $email = trim($body['email'] ?? $_GET['email'] ?? '');
            $deviceId = trim($body['device_id'] ?? $_GET['device_id'] ?? '');

            // Validar formato da chave (XXXX-XXXX-XXXX, só maiúsculas e dígitos)
            if (!preg_match('/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/', $licenseKey)) {
                jsonResponse([
                    'status' => 'error',
                    'valid' => false,
                    'message' => 'Formato de licença inválido.',
                ]);
            }

            $pdo = getPDO();
            $stmt = $pdo->prepare(
                "SELECT * FROM licencas
                  WHERE license_key = ?
                    AND status      = 'ativo'
                  LIMIT 1"
            );
            $stmt->execute([$licenseKey]);
            $licenca = $stmt->fetch();

            // Licença não encontrada ou não ativa
            if (!$licenca) {
                jsonResponse([
                    'status' => 'error',
                    'valid' => false,
                    'message' => 'Licença inválida ou não encontrada.',
                ]);
            }

            // Verificar bloqueio por dispositivo diferente
            if (!empty($licenca['device_id']) && $licenca['device_id'] !== $deviceId) {
                jsonResponse([
                    'status' => 'error',
                    'valid' => false,
                    'message' => 'Esta licença já foi ativada em outro dispositivo. Entre em contato com o suporte.',
                ]);
            }

            // Primeira ativação: salvar device_id, email e data
            if (empty($licenca['device_id'])) {
                $update = $pdo->prepare(
                    "UPDATE licencas
                        SET device_id  = ?,
                            email_cliente = ?,
                            ativado_em = NOW()
                      WHERE license_key = ?"
                );
                $update->execute([$deviceId, $email, $licenseKey]);
            }

            jsonResponse([
                'status' => 'success',
                'valid' => true,
                'client' => $licenca['email_cliente'] ?: $email,
                'sistema' => $licenca['sistema'],
            ]);
            break;


        // ══════════════════════════════════════
        // ACTION: confirm_receipt
        // Marca o recibo do sistema como confirmado
        // ══════════════════════════════════════
        case 'confirm_receipt':
            $licenseKey = trim($body['license_key'] ?? $_GET['license_key'] ?? '');

            if (empty($licenseKey)) {
                jsonResponse([
                    'status' => 'error',
                    'message' => 'license_key é obrigatório.',
                ], 400);
            }

            $pdo = getPDO();
            $update = $pdo->prepare(
                'UPDATE licencas SET recibo_confirmado = 1 WHERE license_key = ?'
            );
            $update->execute([$licenseKey]);

            jsonResponse(['status' => 'success']);
            break;


        // ══════════════════════════════════════
        // ACTION desconhecida
        // ══════════════════════════════════════
        default:
            jsonResponse([
                'status' => 'error',
                'message' => 'Acao invalida',
            ], 400);
    }

} catch (PDOException $e) {
    error_log('[api_licenca_ml.php] PDOException: ' . $e->getMessage());
    jsonResponse([
        'status' => 'error',
        'message' => 'Erro interno do servidor. Tente novamente.',
    ], 500);
}

// ─────────────────────────────────────────────
// Função auxiliar para saída JSON
// ─────────────────────────────────────────────

/**
 * Retorna uma resposta JSON e encerra a execução.
 *
 * @param array $data       Dados a serializar
 * @param int   $httpCode   Código HTTP (padrão 200)
 */
function jsonResponse(array $data, int $httpCode = 200): void
{
    http_response_code($httpCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
