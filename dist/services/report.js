"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportService = getReportService;
const pdfkit_1 = __importDefault(require("pdfkit"));
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
function newDoc(title) {
    const doc = new pdfkit_1.default();
    const chunks = [];
    doc.on('data', d => chunks.push(d));
    doc.fontSize(20).text(title);
    doc.moveDown();
    return { doc, chunks };
}
class DefaultReportService {
    async generateFinancialReport(parameters) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const { doc, chunks } = newDoc('Relatório Financeiro');
        const where = ["status IN ('succeeded','approved','paid')"];
        const values = [];
        if (parameters.from) {
            values.push(parameters.from);
            where.push(`created_at >= $${values.length}`);
        }
        if (parameters.to) {
            values.push(parameters.to);
            where.push(`created_at <= $${values.length}`);
        }
        const sql = `SELECT id, amount, currency, provider, status, created_at FROM payments WHERE ${where.join(' AND ')} ORDER BY created_at DESC ${parameters.limit ? `LIMIT ${parameters.limit}` : ''}`;
        const q = await postgres_1.pg.query(sql, values);
        const sum = q.rows.reduce((a, r) => a + Number(r.amount), 0);
        doc.fontSize(12).text(`Pagamentos: ${q.rows.length}`);
        doc.text(`Total (centavos): ${sum}`);
        doc.moveDown();
        for (const r of q.rows) {
            doc.text(`${new Date(r.created_at).toLocaleString()} | ${r.provider} | ${r.currency} ${Number(r.amount)}`);
        }
        await new Promise(resolve => { doc.on('end', () => resolve()); doc.end(); });
        return Buffer.concat(chunks);
    }
    async generateUserReport(parameters) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const { doc, chunks } = newDoc('Relatório de Usuários');
        const where = [];
        const values = [];
        if (parameters.from) {
            values.push(parameters.from);
            where.push(`created_at >= $${values.length}`);
        }
        if (parameters.to) {
            values.push(parameters.to);
            where.push(`created_at <= $${values.length}`);
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const total = await postgres_1.pg.query(`SELECT COUNT(*)::int AS c FROM users ${whereSql}`, values);
        const list = await postgres_1.pg.query(`SELECT id, email, name, user_type, created_at FROM users ${whereSql} ORDER BY created_at DESC ${parameters.limit ? `LIMIT ${parameters.limit}` : ''}`, values);
        doc.fontSize(12).text(`Total de usuários: ${total.rows[0]?.c || 0}`);
        doc.moveDown();
        for (const u of list.rows) {
            doc.text(`${new Date(u.created_at).toLocaleString()} | ${u.email} | ${u.name || ''} | ${u.user_type}`);
        }
        await new Promise(resolve => { doc.on('end', () => resolve()); doc.end(); });
        return Buffer.concat(chunks);
    }
    async generateServiceReport(parameters) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const { doc, chunks } = newDoc('Relatório de Serviços');
        const where = [];
        const values = [];
        if (parameters.status) {
            values.push(parameters.status);
            where.push(`status = $${values.length}`);
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const total = await postgres_1.pg.query(`SELECT COUNT(*)::int AS c FROM mei_services ${whereSql}`, values);
        const list = await postgres_1.pg.query(`SELECT id, user_id, cnpj, company_name, status, opened_date, created_at FROM mei_services ${whereSql} ORDER BY created_at DESC ${parameters.limit ? `LIMIT ${parameters.limit}` : ''}`, values);
        doc.fontSize(12).text(`Total de serviços MEI: ${total.rows[0]?.c || 0}`);
        doc.moveDown();
        for (const s of list.rows) {
            doc.text(`${new Date(s.created_at).toLocaleString()} | ${s.status} | ${s.company_name} | ${s.cnpj || ''}`);
        }
        await new Promise(resolve => { doc.on('end', () => resolve()); doc.end(); });
        return Buffer.concat(chunks);
    }
    getReportFormats() { return ['pdf', 'csv']; }
}
function getReportService() { return new DefaultReportService(); }
