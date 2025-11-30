"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pg = void 0;
exports.migrate = migrate;
const pg_1 = require("pg");
const env_1 = require("./env");
exports.pg = env_1.env.PG_CONNECTION_STRING ? new pg_1.Pool({ connectionString: env_1.env.PG_CONNECTION_STRING }) : new pg_1.Pool({});
async function migrate() {
    if (!env_1.env.PG_CONNECTION_STRING)
        return;
    const createExtension = 'CREATE EXTENSION IF NOT EXISTS pgcrypto;';
    const createTable = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      user_type VARCHAR(50) DEFAULT 'client',
      phone VARCHAR(20),
      cpf VARCHAR(14) UNIQUE,
      cnpj VARCHAR(18),
      address_street VARCHAR(255),
      address_city VARCHAR(100),
      address_state VARCHAR(2),
      address_cep VARCHAR(9),
      subscription_plan VARCHAR(50) DEFAULT 'free',
      subscription_status VARCHAR(20) DEFAULT 'active',
      stripe_customer_id VARCHAR(255),
      current_period_end TIMESTAMP,
      email_notifications BOOLEAN DEFAULT true,
      email_marketing BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP
    );
  `;
    const createCurriculaTable = `
    CREATE TABLE IF NOT EXISTS curricula (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      template VARCHAR(100) DEFAULT 'modern',
      title VARCHAR(255) NOT NULL,
      is_public BOOLEAN DEFAULT false,
      share_token VARCHAR(100) UNIQUE,
      download_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const createIndexEmail = 'CREATE INDEX IF NOT EXISTS idx_email ON users(email);';
    const createIndexSubscription = 'CREATE INDEX IF NOT EXISTS idx_subscription ON users(subscription_status, subscription_plan);';
    const createIndexCurriculaUser = 'CREATE INDEX IF NOT EXISTS idx_user_id ON curricula(user_id);';
    const createIndexCurriculaShare = 'CREATE INDEX IF NOT EXISTS idx_share_token ON curricula(share_token);';
    const createRefreshTokens = `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const createPasswordResets = `
    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const indexRefreshUser = 'CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);';
    const indexRefreshExpires = 'CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);';
    const indexResetUser = 'CREATE INDEX IF NOT EXISTS idx_reset_user ON password_resets(user_id);';
    const indexResetToken = 'CREATE INDEX IF NOT EXISTS idx_reset_token ON password_resets(token);';
    const createAppointments = `
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      service_type VARCHAR(100) NOT NULL,
      scheduled_date TIMESTAMP NOT NULL,
      duration INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      location_type VARCHAR(20) DEFAULT 'in_person',
      address TEXT,
      online_meeting_url VARCHAR(500),
      reminder_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxApptUser = 'CREATE INDEX IF NOT EXISTS idx_appt_user ON appointments(user_id)';
    const idxApptTime = 'CREATE INDEX IF NOT EXISTS idx_appt_scheduled_date ON appointments(scheduled_date)';
    const idxApptStatus = 'CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status)';
    const createPayments = `
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'brl',
      description VARCHAR(255),
      status VARCHAR(30) DEFAULT 'pending',
      provider VARCHAR(50) DEFAULT 'stripe',
      provider_payment_id VARCHAR(255),
      receipt_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxPayUser = 'CREATE INDEX IF NOT EXISTS idx_pay_user ON payments(user_id)';
    const idxPayStatus = 'CREATE INDEX IF NOT EXISTS idx_pay_status ON payments(status)';
    const createReports = `
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      report_type VARCHAR(50) NOT NULL,
      parameters JSONB,
      file_url VARCHAR(500),
      generated_by UUID REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );
  `;
    const createAdminLogs = `
    CREATE TABLE IF NOT EXISTS admin_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id UUID,
      details JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const createNotifications = `
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      related_service VARCHAR(100),
      related_id UUID,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxNotifUser = 'CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id)';
    const idxNotifRead = 'CREATE INDEX IF NOT EXISTS idx_notification_is_read ON notifications(is_read)';
    const createSupportTickets = `
    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      priority VARCHAR(20) DEFAULT 'medium',
      assigned_to UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxSupportUser = 'CREATE INDEX IF NOT EXISTS idx_support_user ON support_tickets(user_id)';
    const idxSupportStatus = 'CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status)';
    const createTicketMessages = `
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      message TEXT NOT NULL,
      attachments JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxTicketMsgTicket = 'CREATE INDEX IF NOT EXISTS idx_ticket_id ON ticket_messages(ticket_id)';
    await exports.pg.query(createExtension);
    await exports.pg.query(createTable);
    await exports.pg.query(createCurriculaTable);
    await exports.pg.query("ALTER TABLE curricula ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP");
    await exports.pg.query("ALTER TABLE curricula ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0");
    await exports.pg.query("ALTER TABLE curricula ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(255)");
    const createMei = `
    CREATE TABLE IF NOT EXISTS mei_services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      cnpj VARCHAR(18) UNIQUE,
      company_name VARCHAR(255) NOT NULL,
      activity_code VARCHAR(10) NOT NULL,
      activity_description VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      opened_date DATE,
      business_address_street VARCHAR(255),
      business_address_number VARCHAR(10),
      business_address_complement VARCHAR(100),
      business_address_city VARCHAR(100),
      business_address_state VARCHAR(2),
      business_address_cep VARCHAR(9),
      documents JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxMeiUser = 'CREATE INDEX IF NOT EXISTS idx_mei_user_id ON mei_services(user_id)';
    const idxMeiCnpj = 'CREATE INDEX IF NOT EXISTS idx_mei_cnpj ON mei_services(cnpj)';
    const idxMeiStatus = 'CREATE INDEX IF NOT EXISTS idx_mei_status ON mei_services(status)';
    const createMeiNfes = `
    CREATE TABLE IF NOT EXISTS mei_nfes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mei_service_id UUID REFERENCES mei_services(id) ON DELETE CASCADE,
      number VARCHAR(50) UNIQUE,
      value DECIMAL(10,2) NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      client_cpf_cnpj VARCHAR(18),
      service_description TEXT,
      issue_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'issued',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxMeiNfeService = 'CREATE INDEX IF NOT EXISTS idx_mei_nfe_service_id ON mei_nfes(mei_service_id)';
    const idxMeiNfeIssue = 'CREATE INDEX IF NOT EXISTS idx_mei_nfe_issue_date ON mei_nfes(issue_date)';
    const createMeiInvoices = `
    CREATE TABLE IF NOT EXISTS mei_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mei_service_id UUID REFERENCES mei_services(id) ON DELETE CASCADE,
      reference_month VARCHAR(7),
      due_date DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      barcode VARCHAR(100),
      payment_receipt_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxMeiInvService = 'CREATE INDEX IF NOT EXISTS idx_mei_service_id ON mei_invoices(mei_service_id)';
    const idxMeiInvDue = 'CREATE INDEX IF NOT EXISTS idx_mei_due_date ON mei_invoices(due_date)';
    const idxMeiInvStatus = 'CREATE INDEX IF NOT EXISTS idx_mei_status ON mei_invoices(status)';
    const createAnnualDecl = `
    CREATE TABLE IF NOT EXISTS mei_annual_declarations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mei_service_id UUID REFERENCES mei_services(id) ON DELETE CASCADE,
      reference_year INTEGER NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      submitted_at TIMESTAMP,
      receipt_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    const idxAnnualService = 'CREATE INDEX IF NOT EXISTS idx_mei_annual_service ON mei_annual_declarations(mei_service_id)';
    const idxAnnualYear = 'CREATE INDEX IF NOT EXISTS idx_mei_annual_year ON mei_annual_declarations(reference_year)';
    await exports.pg.query(createIndexEmail);
    await exports.pg.query(createIndexSubscription);
    await exports.pg.query(createIndexCurriculaUser);
    await exports.pg.query(createIndexCurriculaShare);
    await exports.pg.query(createAppointments);
    await exports.pg.query(idxApptUser);
    await exports.pg.query(idxApptTime);
    await exports.pg.query(idxApptStatus);
    const hasOldService = await exports.pg.query("SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='service'");
    if (hasOldService.rowCount)
        await exports.pg.query('ALTER TABLE appointments RENAME COLUMN service TO service_type');
    const hasOldScheduled = await exports.pg.query("SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='scheduled_at'");
    if (hasOldScheduled.rowCount)
        await exports.pg.query('ALTER TABLE appointments RENAME COLUMN scheduled_at TO scheduled_date');
    await exports.pg.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 60');
    await exports.pg.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) DEFAULT 'in_person'");
    await exports.pg.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS address TEXT');
    await exports.pg.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS online_meeting_url VARCHAR(500)');
    await exports.pg.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE');
    await exports.pg.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE');
    await exports.pg.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT FALSE');
    await exports.pg.query(createMei);
    await exports.pg.query(idxMeiUser);
    await exports.pg.query(idxMeiCnpj);
    await exports.pg.query(idxMeiStatus);
    await exports.pg.query(createMeiInvoices);
    await exports.pg.query(idxMeiInvService);
    await exports.pg.query(idxMeiInvDue);
    await exports.pg.query(idxMeiInvStatus);
    await exports.pg.query(createAnnualDecl);
    await exports.pg.query(idxAnnualService);
    await exports.pg.query(idxAnnualYear);
    await exports.pg.query(createMeiNfes);
    await exports.pg.query(idxMeiNfeService);
    await exports.pg.query(idxMeiNfeIssue);
    await exports.pg.query(createPayments);
    await exports.pg.query(idxPayUser);
    await exports.pg.query(idxPayStatus);
    await exports.pg.query(createAdminLogs);
    await exports.pg.query(createReports);
    await exports.pg.query(createNotifications);
    await exports.pg.query(idxNotifUser);
    await exports.pg.query(idxNotifRead);
    await exports.pg.query(createSupportTickets);
    await exports.pg.query(idxSupportUser);
    await exports.pg.query(idxSupportStatus);
    await exports.pg.query(createTicketMessages);
    await exports.pg.query(idxTicketMsgTicket);
    await exports.pg.query(createRefreshTokens);
    await exports.pg.query(createPasswordResets);
    await exports.pg.query(indexRefreshUser);
    await exports.pg.query(indexRefreshExpires);
    await exports.pg.query(indexResetUser);
    await exports.pg.query(indexResetToken);
}
