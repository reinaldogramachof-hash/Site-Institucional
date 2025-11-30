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
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middlewares/validate");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
const intentSchema = joi_1.default.object({
    amount: joi_1.default.number().integer().min(100).required(),
    currency: joi_1.default.string().default('brl'),
    description: joi_1.default.string().max(255).optional(),
    provider: joi_1.default.string().valid('stripe', 'mercadopago').default('stripe')
});
router.post('/create-intent', auth_1.requireAuth, (0, validate_1.validate)(intentSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'service_unavailable' });
    const uid = req.userId;
    const { amount, currency, description, provider } = req.body;
    if (provider === 'stripe') {
        if (!env_1.env.STRIPE_SECRET_KEY)
            return res.status(503).json({ error: 'provider_unavailable' });
        const stripe = new (require('stripe'))(env_1.env.STRIPE_SECRET_KEY);
        const pi = await stripe.paymentIntents.create({ amount, currency, description, automatic_payment_methods: { enabled: true } });
        const ins = `INSERT INTO payments (user_id, amount, currency, description, status, provider, provider_payment_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`;
        const { rows } = await postgres_1.pg.query(ins, [uid, amount, currency, description || null, pi.status, 'stripe', pi.id]);
        return res.json({ id: rows[0].id, client_secret: pi.client_secret, provider: 'stripe' });
    }
    else {
        if (!env_1.env.MERCADOPAGO_ACCESS_TOKEN)
            return res.status(503).json({ error: 'provider_unavailable' });
        const mp = await Promise.resolve().then(() => __importStar(require('mercadopago')));
        mp.configure({ access_token: env_1.env.MERCADOPAGO_ACCESS_TOKEN });
        const pref = await mp.preferences.create({ items: [{ title: description || 'Pagamento', quantity: 1, currency_id: String(currency).toUpperCase(), unit_price: amount / 100 }] });
        const ins = `INSERT INTO payments (user_id, amount, currency, description, status, provider, provider_payment_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`;
        const { rows } = await postgres_1.pg.query(ins, [uid, amount, currency, description || null, 'pending', 'mercadopago', pref?.body?.id]);
        return res.json({ id: rows[0].id, init_point: pref?.body?.init_point, sandbox_init_point: pref?.body?.sandbox_init_point, provider: 'mercadopago' });
    }
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { rows } = await postgres_1.pg.query('SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC', [uid]);
    return res.json({ items: rows });
});
router.get('/history', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { rows } = await postgres_1.pg.query('SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC', [uid]);
    return res.json({ items: rows });
});
const confirmSchema = joi_1.default.object({
    provider: joi_1.default.string().valid('stripe', 'mercadopago').required(),
    provider_payment_id: joi_1.default.string().required()
});
router.post('/confirm', auth_1.requireAuth, (0, validate_1.validate)(confirmSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { provider, provider_payment_id } = req.body;
    let status = 'pending';
    let receipt_url = null;
    if (provider === 'stripe' && env_1.env.STRIPE_SECRET_KEY) {
        const stripe = new (require('stripe'))(env_1.env.STRIPE_SECRET_KEY);
        const pi = await stripe.paymentIntents.retrieve(provider_payment_id);
        status = pi.status;
        try {
            const charges = pi.charges?.data || [];
            if (charges.length)
                receipt_url = charges[0]?.receipt_url || null;
        }
        catch { }
    }
    else if (provider === 'mercadopago' && env_1.env.MERCADOPAGO_ACCESS_TOKEN) {
        const mp = await Promise.resolve().then(() => __importStar(require('mercadopago')));
        mp.configure({ access_token: env_1.env.MERCADOPAGO_ACCESS_TOKEN });
        const pay = await mp.payment.get(provider_payment_id);
        const st = pay?.body?.status;
        status = st === 'approved' ? 'succeeded' : st || 'pending';
        receipt_url = pay?.body?.receipt_url || null;
    }
    else {
        return res.status(503).json({ error: 'provider_unavailable' });
    }
    await postgres_1.pg.query('UPDATE payments SET status=$1, receipt_url=$2, updated_at=NOW() WHERE provider=$3 AND provider_payment_id=$4', [status, receipt_url, provider, provider_payment_id]);
    return res.json({ ok: true, status });
});
router.post('/webhook/stripe', async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.STRIPE_SECRET_KEY)
        return res.status(503).json({ error: 'service_unavailable' });
    const stripe = new (require('stripe'))(env_1.env.STRIPE_SECRET_KEY);
    let event = req.body;
    try {
        const sig = req.headers['stripe-signature'];
        if (env_1.env.STRIPE_WEBHOOK_SECRET && sig)
            event = stripe.webhooks.constructEvent(req.rawBody || JSON.stringify(req.body), sig, env_1.env.STRIPE_WEBHOOK_SECRET);
    }
    catch {
        return res.status(400).send('invalid');
    }
    if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        await postgres_1.pg.query('UPDATE payments SET status=$1, updated_at=NOW() WHERE provider=$2 AND provider_payment_id=$3', [pi.status, 'stripe', pi.id]);
    }
    if (event.type === 'payment_intent.payment_failed') {
        const pi = event.data.object;
        await postgres_1.pg.query('UPDATE payments SET status=$1, updated_at=NOW() WHERE provider=$2 AND provider_payment_id=$3', [pi.status, 'stripe', pi.id]);
    }
    return res.json({ received: true });
});
router.post('/webhook/mercadopago', async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.MERCADOPAGO_ACCESS_TOKEN)
        return res.status(503).json({ error: 'service_unavailable' });
    const mp = await Promise.resolve().then(() => __importStar(require('mercadopago')));
    mp.configure({ access_token: env_1.env.MERCADOPAGO_ACCESS_TOKEN });
    const paymentId = req.body?.data?.id || req.query?.id;
    if (!paymentId)
        return res.json({ ok: true });
    try {
        const pay = await mp.payment.get(paymentId);
        const st = pay?.body?.status;
        const status = st === 'approved' ? 'succeeded' : st || 'pending';
        await postgres_1.pg.query('UPDATE payments SET status=$1, updated_at=NOW() WHERE provider=$2 AND provider_payment_id=$3', [status, 'mercadopago', String(paymentId)]);
    }
    catch { }
    return res.json({ received: true });
});
exports.default = router;
