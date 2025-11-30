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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middlewares/validate");
const env_1 = require("../config/env");
function onlyDigits(s) { return s.replace(/\D/g, ''); }
function validCPF(cpf) {
    const s = onlyDigits(cpf);
    if (s.length !== 11 || /^([0-9])\1{10}$/.test(s))
        return false;
    let sum = 0;
    for (let i = 0; i < 9; i++)
        sum += parseInt(s[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10)
        d1 = 0;
    if (d1 !== parseInt(s[9]))
        return false;
    sum = 0;
    for (let i = 0; i < 10; i++)
        sum += parseInt(s[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10)
        d2 = 0;
    return d2 === parseInt(s[10]);
}
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
const router = (0, express_1.Router)();
router.get('/profile', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const q = 'SELECT id, email, name, user_type, phone, cpf, cnpj, address_street, address_city, address_state, address_cep, subscription_plan, subscription_status, stripe_customer_id, current_period_end, email_notifications, email_marketing, created_at, updated_at, last_login FROM users WHERE id=$1';
    const { rows } = await postgres_1.pg.query(q, [uid]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    return res.json(rows[0]);
});
const profileSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).optional(),
    phone: joi_1.default.string().optional(),
    cpf: joi_1.default.string().optional(),
    cnpj: joi_1.default.string().optional(),
    address_street: joi_1.default.string().optional(),
    address_city: joi_1.default.string().optional(),
    address_state: joi_1.default.string().length(2).optional(),
    address_cep: joi_1.default.string().optional(),
    email_notifications: joi_1.default.boolean().optional(),
    email_marketing: joi_1.default.boolean().optional()
});
router.put('/profile', auth_1.requireAuth, (0, validate_1.validate)(profileSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { cpf, cnpj } = req.body;
    if (cpf && !validCPF(cpf))
        return res.status(400).json({ error: 'invalid_cpf' });
    if (cnpj && !validCNPJ(cnpj))
        return res.status(400).json({ error: 'invalid_cnpj' });
    const fields = ['name', 'phone', 'cpf', 'cnpj', 'address_street', 'address_city', 'address_state', 'address_cep', 'email_notifications', 'email_marketing'];
    const updates = [];
    const values = [];
    fields.forEach((f, i) => {
        if (req.body[f] !== undefined) {
            updates.push(`${f}=$${updates.length + 1}`);
            values.push(req.body[f]);
        }
    });
    if (!updates.length)
        return res.json({ ok: true });
    values.push(uid);
    const sql = `UPDATE users SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`;
    await postgres_1.pg.query(sql, values);
    return res.json({ ok: true });
});
router.get('/subscription', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { rows } = await postgres_1.pg.query('SELECT subscription_plan, subscription_status, stripe_customer_id, current_period_end FROM users WHERE id=$1', [uid]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    return res.json(rows[0]);
});
const subSchema = joi_1.default.object({ plan: joi_1.default.string().valid('free', 'mei', 'premium').required(), priceId: joi_1.default.string().optional() });
router.post('/subscription', auth_1.requireAuth, (0, validate_1.validate)(subSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { plan, priceId } = req.body;
    const userRes = await postgres_1.pg.query('SELECT email, stripe_customer_id FROM users WHERE id=$1', [uid]);
    if (!userRes.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const email = userRes.rows[0].email;
    let stripeCustomer = userRes.rows[0].stripe_customer_id;
    let periodEnd = null;
    if (env_1.env.STRIPE_SECRET_KEY && priceId) {
        const Stripe = (await Promise.resolve().then(() => __importStar(require('stripe')))).default;
        const stripe = new Stripe(env_1.env.STRIPE_SECRET_KEY);
        if (!stripeCustomer) {
            const customer = await stripe.customers.create({ email });
            stripeCustomer = customer.id;
            await postgres_1.pg.query('UPDATE users SET stripe_customer_id=$1 WHERE id=$2', [stripeCustomer, uid]);
        }
        const subscription = await stripe.subscriptions.create({ customer: stripeCustomer, items: [{ price: priceId }], expand: ['latest_invoice.payment_intent'] });
        periodEnd = new Date(subscription.data.current_period_end * 1000);
    }
    await postgres_1.pg.query('UPDATE users SET subscription_plan=$1, subscription_status=$2, current_period_end=$3 WHERE id=$4', [plan, 'active', periodEnd, uid]);
    return res.json({ ok: true });
});
router.delete('/subscription', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const userRes = await postgres_1.pg.query('SELECT stripe_customer_id FROM users WHERE id=$1', [uid]);
    if (!userRes.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const stripeCustomer = userRes.rows[0].stripe_customer_id;
    if (env_1.env.STRIPE_SECRET_KEY && stripeCustomer) {
        const Stripe = (await Promise.resolve().then(() => __importStar(require('stripe')))).default;
        const stripe = new Stripe(env_1.env.STRIPE_SECRET_KEY);
        const subs = await stripe.subscriptions.list({ customer: stripeCustomer, status: 'active' });
        for (const s of subs.data) {
            await stripe.subscriptions.cancel(s.id);
        }
    }
    await postgres_1.pg.query('UPDATE users SET subscription_status=$1 WHERE id=$2', ['canceled', uid]);
    return res.json({ ok: true });
});
exports.default = router;
