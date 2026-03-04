<?php
/**
 * config.php — Configuração central do sistema de pagamento e licenças
 * Plena Informática — São José dos Campos
 *
 * ATENÇÃO: Preencha as constantes abaixo antes de publicar no servidor.
 */

// ─────────────────────────────────────────────
// MERCADO PAGO
// ─────────────────────────────────────────────

/** Token de acesso da API do Mercado Pago (produção) */
define('MP_ACCESS_TOKEN', 'APP_USR-4084040189980704-030413-06a65397f2c8b514fb4b21e70b895acc-3202258925');

/** Public Key do Mercado Pago (caso precise no front-end) */
define('MP_PUBLIC_KEY', 'APP_USR-04b911d8-3f12-4c59-b912-f61790a76a5b');

// ─────────────────────────────────────────────
// BANCO DE DADOS
// ─────────────────────────────────────────────

define('DB_HOST', 'localhost');
define('DB_NAME', 'hg2fbe99_plena_informatica');
define('DB_USER', 'hg2fbe99_reinaldogramacho');
define('DB_PASS', 'Rein@ldo1912');

// ─────────────────────────────────────────────
// URLS E PREÇOS
// ─────────────────────────────────────────────

/** URL base do site (sem barra final) */
define('BASE_URL', 'https://plenainformatica.com.br');

/** Preço padrão de cada licença em reais */
define('PRECO_SISTEMA', 97.00);

// ─────────────────────────────────────────────
// FUNÇÕES UTILITÁRIAS
// ─────────────────────────────────────────────

/**
 * Retorna uma conexão PDO configurada com utf8mb4 e modo de exceção.
 *
 * @return PDO
 * @throws PDOException
 */
function getPDO(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=utf8mb4',
            DB_HOST,
            DB_NAME
        );

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    }

    return $pdo;
}

/**
 * Gera uma chave de licença única no formato XXXX-XXXX-XXXX.
 *
 * Usa apenas caracteres alfanuméricos maiúsculos sem ambiguidade
 * (sem O, 0, I, 1 para evitar confusão visual).
 *
 * @return string Chave única garantida por verificação no banco
 */
function gerarLicenca(): string
{
    // Caracteres sem ambiguidade visual
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    do {
        $partes = [];
        for ($g = 0; $g < 3; $g++) {
            $bloco = '';
            for ($c = 0; $c < 4; $c++) {
                $bloco .= $chars[random_int(0, strlen($chars) - 1)];
            }
            $partes[] = $bloco;
        }
        $chave = implode('-', $partes); // Ex.: ABCD-EFGH-JKLM

        // Verificar unicidade no banco
        $pdo = getPDO();
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM licencas WHERE license_key = ?');
        $stmt->execute([$chave]);
        $existe = (int) $stmt->fetchColumn() > 0;

    } while ($existe);

    return $chave;
}
