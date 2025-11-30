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
exports.getPaymentGateway = getPaymentGateway;
const env_1 = require("../config/env");
class StripeGateway {
    constructor(secret) { this.stripe = new (require('stripe'))(secret); }
    async createPaymentIntent(amount, currency, metadata) {
        const pi = await this.stripe.paymentIntents.create({ amount, currency, metadata, automatic_payment_methods: { enabled: true } });
        return { id: pi.id, client_secret: pi.client_secret, status: pi.status, provider: 'stripe' };
    }
    async confirmPayment(paymentIntentId) {
        const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
        let receipt;
        try {
            const charges = pi.charges?.data || [];
            if (charges.length)
                receipt = charges[0]?.receipt_url;
        }
        catch { }
        return { status: pi.status, receipt_url: receipt };
    }
    async createPixPayment(amount, metadata) {
        const pi = await this.stripe.paymentIntents.create({ amount, currency: 'brl', payment_method_types: ['pix'], metadata });
        const next = pi.next_action || {};
        const qr = next?.pix_qr_code_data || next?.display_qr_code?.data || '';
        const b64 = next?.pix_qr_code_base64 || '';
        const exp = next?.pix_expires_at || '';
        return { id: pi.id, qr_code: String(qr), qr_code_base64: b64 ? String(b64) : undefined, expires_at: exp ? String(exp) : undefined, status: pi.status };
    }
    async createBoletoPayment(amount, dueDate, metadata) {
        const pi = await this.stripe.paymentIntents.create({ amount, currency: 'brl', payment_method_types: ['boleto'], payment_method_options: { boleto: { expires_after_days: 7 } }, metadata });
        const next = pi.next_action || {};
        const url = next?.boleto_display_details?.hosted_voucher_url || '';
        const barcode = next?.boleto_display_details?.number || '';
        return { id: pi.id, boleto_url: String(url), barcode: barcode ? String(barcode) : undefined, due_date: dueDate.toISOString(), status: pi.status };
    }
    async handleWebhook(event) { }
}
class MercadoPagoGateway {
    constructor(token) { }
    async init() { if (!this.sdk) {
        const mp = await Promise.resolve().then(() => __importStar(require('mercadopago')));
        mp.configure({ access_token: env_1.env.MERCADOPAGO_ACCESS_TOKEN });
        this.sdk = mp;
    } }
    async createPaymentIntent(amount, currency, metadata) {
        await this.init();
        const pref = await this.sdk.preferences.create({ items: [{ title: metadata?.description || 'Pagamento', quantity: 1, currency_id: String(currency).toUpperCase(), unit_price: amount / 100 }], metadata });
        return { id: String(pref?.body?.id), init_point: String(pref?.body?.init_point || ''), sandbox_init_point: String(pref?.body?.sandbox_init_point || ''), status: 'pending', provider: 'mercadopago' };
    }
    async confirmPayment(paymentIntentId) {
        await this.init();
        const pay = await this.sdk.payment.get(paymentIntentId);
        const st = pay?.body?.status;
        const status = st === 'approved' ? 'succeeded' : st || 'pending';
        const receipt = pay?.body?.receipt_url || undefined;
        return { status, receipt_url: receipt };
    }
    async createPixPayment(amount, metadata) {
        await this.init();
        const res = await this.sdk.payment.create({ transaction_amount: amount / 100, description: metadata?.description || 'PIX', payment_method_id: 'pix' });
        const td = res?.body?.point_of_interaction?.transaction_data || {};
        const id = String(res?.body?.id);
        const qr = String(td?.qr_code || '');
        const b64 = String(td?.qr_code_base64 || '');
        const exp = String(td?.expiration_date || '');
        const st = String(res?.body?.status || 'pending');
        return { id, qr_code: qr, qr_code_base64: b64 || undefined, expires_at: exp || undefined, status: st };
    }
    async createBoletoPayment(amount, dueDate, metadata) {
        await this.init();
        const res = await this.sdk.payment.create({ transaction_amount: amount / 100, description: metadata?.description || 'Boleto', payment_method_id: 'ticket' });
        const id = String(res?.body?.id);
        const url = String(res?.body?.transaction_details?.external_resource_url || '');
        const barcode = String(res?.body?.barcode?.content || '');
        const st = String(res?.body?.status || 'pending');
        return { id, boleto_url: url, barcode: barcode || undefined, due_date: dueDate.toISOString(), status: st };
    }
    async handleWebhook(event) { }
}
function getPaymentGateway(provider) {
    if (provider === 'mercadopago' && env_1.env.MERCADOPAGO_ACCESS_TOKEN)
        return new MercadoPagoGateway(env_1.env.MERCADOPAGO_ACCESS_TOKEN);
    if (env_1.env.STRIPE_SECRET_KEY)
        return new StripeGateway(env_1.env.STRIPE_SECRET_KEY);
    return new StripeGateway('');
}
