"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middlewares/validate");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
const cpfPattern = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const cnpjPattern = /^\d{2}\.\d{3}\.\d{3}\/(\d{4})-\d{2}$/;
const nfeCreateSchema = joi_1.default.object({
    number: joi_1.default.string().max(50).required(),
    value: joi_1.default.number().precision(2).required(),
    client_name: joi_1.default.string().max(255).required(),
    client_cpf_cnpj: joi_1.default.string().optional().allow(null),
    service_description: joi_1.default.string().optional(),
    issue_date: joi_1.default.date().required()
});
const createSchema = joi_1.default.object({
    cnpj: joi_1.default.string().pattern(cnpjPattern).required(),
    company_name: joi_1.default.string().max(255).required(),
    activity_code: joi_1.default.string().max(10).required(),
    activity_description: joi_1.default.string().max(255).required(),
    opened_date: joi_1.default.date().optional(),
    business_address_street: joi_1.default.string().optional(),
    business_address_number: joi_1.default.string().optional(),
    business_address_complement: joi_1.default.string().optional(),
    business_address_city: joi_1.default.string().optional(),
    business_address_state: joi_1.default.string().length(2).optional(),
    business_address_cep: joi_1.default.string().optional()
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { rows } = await postgres_1.pg.query('SELECT * FROM mei_services WHERE user_id=$1 ORDER BY created_at DESC', [uid]);
    return res.json({ items: rows });
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const fields = [
        'cnpj', 'company_name', 'activity_code', 'activity_description', 'opened_date',
        'business_address_street', 'business_address_number', 'business_address_complement',
        'business_address_city', 'business_address_state', 'business_address_cep'
    ];
    const values = fields.map(f => req.body[f]);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(',');
    const sql = `INSERT INTO mei_services (user_id, ${fields.join(',')}) VALUES ($1, ${placeholders}) RETURNING id`;
    const { rows } = await postgres_1.pg.query(sql, [uid, ...values]);
    return res.status(201).json({ id: rows[0].id });
});
router.post('/register', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const fields = [
        'cnpj', 'company_name', 'activity_code', 'activity_description', 'opened_date',
        'business_address_street', 'business_address_number', 'business_address_complement',
        'business_address_city', 'business_address_state', 'business_address_cep'
    ];
    const values = fields.map(f => req.body[f]);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(',');
    const sql = `INSERT INTO mei_services (user_id, ${fields.join(',')}) VALUES ($1, ${placeholders}) RETURNING id`;
    const { rows } = await postgres_1.pg.query(sql, [uid, ...values]);
    return res.status(201).json({ id: rows[0].id });
});
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT * FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    return res.json(rows[0]);
});
const invoiceCreateSchema = joi_1.default.object({
    reference_month: joi_1.default.string().pattern(/^\d{4}-\d{2}$/).required(),
    due_date: joi_1.default.date().required(),
    amount: joi_1.default.number().precision(2).required(),
    barcode: joi_1.default.string().max(100).optional()
});
router.get('/:id/invoices', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const list = await postgres_1.pg.query('SELECT * FROM mei_invoices WHERE mei_service_id=$1 ORDER BY due_date DESC', [id]);
    return res.json({ items: list.rows });
});
router.post('/:id/invoices', auth_1.requireAuth, (0, validate_1.validate)(invoiceCreateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const { reference_month, due_date, amount, barcode } = req.body;
    const sql = `INSERT INTO mei_invoices (mei_service_id, reference_month, due_date, amount, barcode) VALUES ($1,$2,$3,$4,$5) RETURNING id`;
    const ins = await postgres_1.pg.query(sql, [id, reference_month, new Date(due_date), amount, barcode || null]);
    return res.status(201).json({ id: ins.rows[0].id });
});
router.post('/:id/invoices/:invoiceId/pay', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.STRIPE_SECRET_KEY)
        return res.status(503).json({ error: 'service_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const invoiceId = String(req.params.invoiceId);
    const own = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!own.rows.length || own.rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const inv = await postgres_1.pg.query('SELECT * FROM mei_invoices WHERE id=$1 AND mei_service_id=$2', [invoiceId, id]);
    if (!inv.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const amountCents = Math.round(Number(inv.rows[0].amount) * 100);
    const stripe = new (require('stripe'))(env_1.env.STRIPE_SECRET_KEY);
    const pi = await stripe.paymentIntents.create({ amount: amountCents, currency: 'brl', description: `MEI DAS ${inv.rows[0].reference_month}`, automatic_payment_methods: { enabled: true } });
    const ins = `INSERT INTO payments (user_id, amount, currency, description, status, provider, provider_payment_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`;
    await postgres_1.pg.query(ins, [uid, amountCents, 'brl', `MEI DAS ${inv.rows[0].reference_month}`, pi.status, 'stripe', pi.id]);
    return res.json({ client_secret: pi.client_secret, payment_intent_id: pi.id });
});
const invoiceUpdateSchema = joi_1.default.object({
    payment_date: joi_1.default.date().optional(),
    status: joi_1.default.string().valid('pending', 'paid', 'overdue').optional(),
    payment_receipt_url: joi_1.default.string().uri().optional()
});
router.patch('/invoices/:invoiceId', auth_1.requireAuth, (0, validate_1.validate)(invoiceUpdateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const invoiceId = String(req.params.invoiceId);
    const q = await postgres_1.pg.query('SELECT ms.user_id FROM mei_invoices mi JOIN mei_services ms ON mi.mei_service_id=ms.id WHERE mi.id=$1', [invoiceId]);
    if (!q.rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (q.rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const set = [];
    const vals = [];
    Object.keys(req.body).forEach(k => { if (invoiceUpdateSchema.extract(k)) {
        set.push(`${k}=$${set.length + 1}`);
        vals.push(req.body[k]);
    } });
    if (!set.length)
        return res.json({ ok: true });
    vals.push(invoiceId);
    const sql = `UPDATE mei_invoices SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`;
    await postgres_1.pg.query(sql, vals);
    return res.json({ ok: true });
});
const updateSchema = joi_1.default.object({
    company_name: joi_1.default.string().max(255).optional(),
    activity_code: joi_1.default.string().max(10).optional(),
    activity_description: joi_1.default.string().max(255).optional(),
    opened_date: joi_1.default.date().optional(),
    business_address_street: joi_1.default.string().optional(),
    business_address_number: joi_1.default.string().optional(),
    business_address_complement: joi_1.default.string().optional(),
    business_address_city: joi_1.default.string().optional(),
    business_address_state: joi_1.default.string().length(2).optional(),
    business_address_cep: joi_1.default.string().optional(),
    status: joi_1.default.string().valid('pending', 'active', 'suspended', 'canceled').optional()
});
router.patch('/:id', auth_1.requireAuth, (0, validate_1.validate)(updateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const set = [];
    const vals = [];
    Object.keys(req.body).forEach(k => { if (updateSchema.extract(k)) {
        set.push(`${k}=$${set.length + 1}`);
        vals.push(req.body[k]);
    } });
    if (!set.length)
        return res.json({ ok: true });
    vals.push(id);
    const sql = `UPDATE mei_services SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`;
    await postgres_1.pg.query(sql, vals);
    return res.json({ ok: true });
});
router.put('/:id', auth_1.requireAuth, (0, validate_1.validate)(updateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const set = [];
    const vals = [];
    Object.keys(req.body).forEach(k => { if (updateSchema.extract(k)) {
        set.push(`${k}=$${set.length + 1}`);
        vals.push(req.body[k]);
    } });
    if (!set.length)
        return res.json({ ok: true });
    vals.push(id);
    const sql = `UPDATE mei_services SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`;
    await postgres_1.pg.query(sql, vals);
    return res.json({ ok: true });
});
const docSchema = joi_1.default.object({
    type: joi_1.default.string().required(),
    url: joi_1.default.string().uri().required(),
    status: joi_1.default.string().default('pending')
});
router.post('/:id/documents', auth_1.requireAuth, (0, validate_1.validate)(docSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const payload = { type: req.body.type, url: req.body.url, uploaded_at: new Date().toISOString(), status: req.body.status };
    await postgres_1.pg.query('UPDATE mei_services SET documents = COALESCE(documents, $2::jsonb) || jsonb_build_array($3::jsonb), updated_at=NOW() WHERE id=$1', [id, '[]', JSON.stringify(payload)]);
    return res.status(201).json({ ok: true });
});
router.get('/:id/nfes', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const list = await postgres_1.pg.query('SELECT * FROM mei_nfes WHERE mei_service_id=$1 ORDER BY issue_date DESC', [id]);
    return res.json({ items: list.rows });
});
router.post('/:id/nfes', auth_1.requireAuth, (0, validate_1.validate)(nfeCreateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const { number, value, client_name, client_cpf_cnpj, service_description, issue_date } = req.body;
    const sql = `INSERT INTO mei_nfes (mei_service_id, number, value, client_name, client_cpf_cnpj, service_description, issue_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`;
    const ins = await postgres_1.pg.query(sql, [id, number, value, client_name, client_cpf_cnpj || null, service_description || null, new Date(issue_date)]);
    return res.status(201).json({ id: ins.rows[0].id });
});
const nfeUpdateSchema = joi_1.default.object({
    status: joi_1.default.string().valid('issued', 'canceled').required()
});
router.patch('/nfes/:nfeId', auth_1.requireAuth, (0, validate_1.validate)(nfeUpdateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const nfeId = String(req.params.nfeId);
    const q = await postgres_1.pg.query('SELECT ms.user_id FROM mei_nfes mn JOIN mei_services ms ON mn.mei_service_id=ms.id WHERE mn.id=$1', [nfeId]);
    if (!q.rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (q.rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    await postgres_1.pg.query('UPDATE mei_nfes SET status=$1, updated_at=NOW() WHERE id=$2', [req.body.status, nfeId]);
    return res.json({ ok: true });
});
router.put('/:id/nfes/:nfeId/cancel', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const nfeId = String(req.params.nfeId);
    const q = await postgres_1.pg.query('SELECT ms.user_id FROM mei_nfes mn JOIN mei_services ms ON mn.mei_service_id=ms.id WHERE mn.id=$1 AND ms.id=$2', [nfeId, id]);
    if (!q.rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (q.rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    await postgres_1.pg.query('UPDATE mei_nfes SET status=$1, updated_at=NOW() WHERE id=$2', ['canceled', nfeId]);
    return res.json({ ok: true });
});
exports.default = router;
router.get('/:id/annual-declaration', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const decl = await postgres_1.pg.query('SELECT * FROM mei_annual_declarations WHERE mei_service_id=$1 AND reference_year=$2', [id, year]);
    return res.json(decl.rows[0] || { reference_year: year, status: 'pending' });
});
const annualCreateSchema = joi_1.default.object({
    reference_year: joi_1.default.number().integer().min(2009).required(),
    receipt_url: joi_1.default.string().uri().optional()
});
router.post('/:id/annual-declaration', auth_1.requireAuth, (0, validate_1.validate)(annualCreateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM mei_services WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const { reference_year, receipt_url } = req.body;
    const existing = await postgres_1.pg.query('SELECT id FROM mei_annual_declarations WHERE mei_service_id=$1 AND reference_year=$2', [id, reference_year]);
    if (existing.rows.length) {
        await postgres_1.pg.query('UPDATE mei_annual_declarations SET status=$1, submitted_at=NOW(), receipt_url=$2, updated_at=NOW() WHERE id=$3', ['submitted', receipt_url || null, existing.rows[0].id]);
        return res.json({ ok: true });
    }
    const sql = `INSERT INTO mei_annual_declarations (mei_service_id, reference_year, status, submitted_at, receipt_url) VALUES ($1,$2,$3,$4,$5) RETURNING id`;
    const ins = await postgres_1.pg.query(sql, [id, reference_year, 'submitted', new Date(), receipt_url || null]);
    return res.status(201).json({ id: ins.rows[0].id });
});
