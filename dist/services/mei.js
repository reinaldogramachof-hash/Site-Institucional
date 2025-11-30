"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCNPJ = validateCNPJ;
exports.getMEIService = getMEIService;
exports.generateMonthlyDAS = generateMonthlyDAS;
exports.checkOverduePayments = checkOverduePayments;
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
function onlyDigits(s) { return s.replace(/\D/g, ''); }
function validCNPJ(cnpj) {
    const s = onlyDigits(cnpj);
    if (s.length !== 14 || /^([0-9])\1{13}$/.test(s))
        return false;
    const calc = (base) => {
        let size = base === 12 ? 12 : 13;
        let sum = 0;
        let pos = base === 12 ? 5 : 6;
        for (let i = 0; i < size; i++) {
            sum += parseInt(s[i]) * pos;
            pos = pos === 2 ? 9 : pos - 1;
        }
        const r = sum % 11;
        return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(12);
    const d2 = calc(13);
    return d1 === parseInt(s[12]) && d2 === parseInt(s[13]);
}
function validateCNPJ(cnpj) { return validCNPJ(cnpj); }
class DefaultMEIService {
    async validateCNPJ(cnpj) { return validCNPJ(cnpj); }
    async registerMEI(data) {
        if (!validCNPJ(data.cnpj))
            return { success: false, message: 'invalid_cnpj' };
        const exists = await postgres_1.pg.query('SELECT id FROM mei_services WHERE cnpj=$1', [data.cnpj]);
        if (exists.rows.length)
            return { success: false, message: 'cnpj_exists' };
        const fields = [
            'user_id', 'cnpj', 'company_name', 'activity_code', 'activity_description', 'opened_date',
            'business_address_street', 'business_address_number', 'business_address_complement',
            'business_address_city', 'business_address_state', 'business_address_cep'
        ];
        const values = [
            data.user_id, data.cnpj, data.company_name, data.activity_code, data.activity_description, data.opened_date || null,
            data.business_address_street || null, data.business_address_number || null, data.business_address_complement || null,
            data.business_address_city || null, data.business_address_state || null, data.business_address_cep || null
        ];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
        const sql = `INSERT INTO mei_services (${fields.join(',')}) VALUES (${placeholders})`;
        await postgres_1.pg.query(sql, values);
        return { success: true, message: 'registered' };
    }
    async generateDAS(meiServiceId, month) {
        const m = month;
        const ref = await postgres_1.pg.query('SELECT id FROM mei_invoices WHERE mei_service_id=$1 AND reference_month=$2', [meiServiceId, m]);
        if (ref.rows.length) {
            const row = await postgres_1.pg.query('SELECT * FROM mei_invoices WHERE id=$1', [ref.rows[0].id]);
            const r = row.rows[0];
            return { id: r.id, mei_service_id: r.mei_service_id, reference_month: r.reference_month, due_date: String(r.due_date), amount: Number(r.amount), status: r.status, barcode: r.barcode || undefined };
        }
        const d = new Date(m + '-20T00:00:00');
        const amt = 7000;
        const barcode = Math.random().toString().slice(2, 14);
        const ins = await postgres_1.pg.query('INSERT INTO mei_invoices (mei_service_id, reference_month, due_date, amount, status, barcode) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [meiServiceId, m, d, amt / 100, 'pending', barcode]);
        const r = ins.rows[0];
        return { id: r.id, mei_service_id: r.mei_service_id, reference_month: r.reference_month, due_date: String(r.due_date), amount: Number(r.amount), status: r.status, barcode: r.barcode || undefined };
    }
    async issueNFe(data) {
        const num = 'NFE-' + Date.now();
        const ins = await postgres_1.pg.query('INSERT INTO mei_nfes (mei_service_id, number, value, client_name, client_cpf_cnpj, service_description, issue_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING number', [
            data.mei_service_id, num, data.value, data.client_name, data.client_cpf_cnpj || null, data.service_description || null, data.issue_date ? new Date(data.issue_date) : new Date(), 'issued'
        ]);
        return { success: true, nfeNumber: ins.rows[0].number };
    }
    async submitAnnualDeclaration(meiServiceId, year) {
        const existing = await postgres_1.pg.query('SELECT id FROM mei_annual_declarations WHERE mei_service_id=$1 AND reference_year=$2', [meiServiceId, year]);
        if (existing.rows.length) {
            await postgres_1.pg.query('UPDATE mei_annual_declarations SET status=$1, submitted_at=NOW(), updated_at=NOW() WHERE id=$2', ['submitted', existing.rows[0].id]);
            return { success: true };
        }
        await postgres_1.pg.query('INSERT INTO mei_annual_declarations (mei_service_id, reference_year, status, submitted_at) VALUES ($1,$2,$3,$4)', [meiServiceId, year, 'submitted', new Date()]);
        return { success: true };
    }
}
function getMEIService() { return new DefaultMEIService(); }
async function sendEmail(to, subject, text) {
    if (env_1.env.SENDGRID_API_KEY) {
        const sg = await Promise.resolve().then(() => __importStar(require('@sendgrid/mail')));
        sg.setApiKey(env_1.env.SENDGRID_API_KEY);
        await sg.send({ to, from: env_1.env.SMTP_FROM || env_1.env.SMTP_USER, subject, text });
        return;
    }
    if (env_1.env.SMTP_HOST && env_1.env.SMTP_USER && env_1.env.SMTP_PASS) {
        const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
        const transporter = nodemailer.createTransport({ host: env_1.env.SMTP_HOST, port: env_1.env.SMTP_PORT, secure: env_1.env.SMTP_PORT === 465, auth: { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS } });
        await transporter.sendMail({ from: env_1.env.SMTP_FROM || env_1.env.SMTP_USER, to, subject, text });
        return;
    }
}
async function generateMonthlyDAS() {
    if (!env_1.env.PG_CONNECTION_STRING)
        return;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const services = await postgres_1.pg.query("SELECT id, user_id, company_name FROM mei_services WHERE status='active'");
    for (const s of services.rows) {
        const exists = await postgres_1.pg.query('SELECT id FROM mei_invoices WHERE mei_service_id=$1 AND reference_month=$2', [s.id, ym]);
        if (exists.rows.length)
            continue;
        const das = await getMEIService().generateDAS(s.id, ym);
        const u = await postgres_1.pg.query('SELECT email, name FROM users WHERE id=$1', [s.user_id]);
        const email = u.rows[0]?.email;
        const name = u.rows[0]?.name || '';
        if (email) {
            const subject = `DAS ${das.reference_month} gerado`;
            const text = `Olá ${name}, geramos o DAS de ${das.reference_month} para ${s.company_name}. Valor: R$ ${das.amount.toFixed(2)}. Vencimento: ${new Date(das.due_date).toLocaleDateString()}.`;
            await sendEmail(email, subject, text);
        }
    }
}
async function checkOverduePayments() {
    if (!env_1.env.PG_CONNECTION_STRING)
        return;
    const q = await postgres_1.pg.query("SELECT mi.id, mi.reference_month, mi.due_date, mi.amount, ms.company_name, u.email, u.name FROM mei_invoices mi JOIN mei_services ms ON mi.mei_service_id=ms.id JOIN users u ON u.id=ms.user_id WHERE mi.status='pending' AND mi.due_date < CURRENT_DATE");
    for (const row of q.rows) {
        await postgres_1.pg.query("UPDATE mei_invoices SET status='overdue', updated_at=NOW() WHERE id=$1", [row.id]);
        const email = row.email;
        if (email) {
            const subject = `DAS em atraso (${row.reference_month})`;
            const text = `Olá ${row.name}, o DAS de ${row.reference_month} para ${row.company_name} está em atraso desde ${new Date(row.due_date).toLocaleDateString()}. Valor: R$ ${Number(row.amount).toFixed(2)}.`;
            await sendEmail(email, subject, text);
        }
    }
}
