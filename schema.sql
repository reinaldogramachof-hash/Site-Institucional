-- ─────────────────────────────────────────────────────────────────────────────
-- schema.sql — Estrutura do banco de dados de licenças
-- Plena Informática — São José dos Campos
--
-- Execute este script no MySQL via cPanel > phpMyAdmin
-- antes de publicar os arquivos PHP no servidor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS licencas (
  id                INT AUTO_INCREMENT PRIMARY KEY,

  -- Chave de licença gerada (formato: XXXX-XXXX-XXXX)
  license_key       VARCHAR(20)  NOT NULL UNIQUE,

  -- Slug do sistema (ex.: gestao-barbearia)
  sistema           VARCHAR(60)  NOT NULL,

  -- Nome legível do sistema (ex.: Gestão Barbearia)
  nome_sistema      VARCHAR(100) NOT NULL,

  -- E-mail do comprador (preenchido na ativação ou no webhook)
  email_cliente     VARCHAR(150) DEFAULT NULL,

  -- ID do pagamento retornado pelo Mercado Pago
  payment_id        VARCHAR(100) DEFAULT NULL,

  -- Estado da licença
  status            ENUM('pendente','ativo','bloqueado') NOT NULL DEFAULT 'pendente',

  -- Identificador único do dispositivo que ativou a licença
  device_id         VARCHAR(255) DEFAULT NULL,

  -- Data/hora da primeira ativação no dispositivo
  ativado_em        DATETIME     DEFAULT NULL,

  -- 1 quando o cliente confirmou o recebimento do sistema
  recibo_confirmado TINYINT(1)   NOT NULL DEFAULT 0,

  -- Data/hora de criação do registro
  criado_em         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Índices para buscas frequentes
  INDEX idx_license_key (license_key),
  INDEX idx_payment_id  (payment_id),
  INDEX idx_sistema     (sistema)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
