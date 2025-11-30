import { env } from '../config/env'

export type PaymentIntent = {
  id: string
  client_secret?: string
  init_point?: string
  sandbox_init_point?: string
  qr_code?: string
  qr_code_base64?: string
  boleto_url?: string
  status: string
  provider: 'stripe' | 'mercadopago'
}

export type PaymentStatus = {
  status: string
  receipt_url?: string
}

export type PixData = {
  id: string
  qr_code: string
  qr_code_base64?: string
  expires_at?: string
  status: string
}

export type BoletoData = {
  id: string
  boleto_url: string
  barcode?: string
  due_date: string
  status: string
}

export interface PaymentGateway {
  createPaymentIntent(amount: number, currency: string, metadata: any): Promise<PaymentIntent>
  confirmPayment(paymentIntentId: string): Promise<PaymentStatus>
  createPixPayment(amount: number, metadata: any): Promise<PixData>
  createBoletoPayment(amount: number, dueDate: Date, metadata: any): Promise<BoletoData>
  handleWebhook(event: any): Promise<void>
}

class StripeGateway implements PaymentGateway {
  stripe: any
  constructor(secret: string) { this.stripe = new (require('stripe'))(secret) }
  async createPaymentIntent(amount: number, currency: string, metadata: any): Promise<PaymentIntent> {
    const pi = await this.stripe.paymentIntents.create({ amount, currency, metadata, automatic_payment_methods: { enabled: true } })
    return { id: pi.id, client_secret: pi.client_secret, status: pi.status, provider: 'stripe' }
  }
  async confirmPayment(paymentIntentId: string): Promise<PaymentStatus> {
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId)
    let receipt: string | undefined
    try {
      const charges = (pi as any).charges?.data || []
      if (charges.length) receipt = charges[0]?.receipt_url
    } catch {}
    return { status: pi.status, receipt_url: receipt }
  }
  async createPixPayment(amount: number, metadata: any): Promise<PixData> {
    const pi = await this.stripe.paymentIntents.create({ amount, currency: 'brl', payment_method_types: ['pix'], metadata })
    const next = (pi as any).next_action || {}
    const qr = next?.pix_qr_code_data || next?.display_qr_code?.data || ''
    const b64 = next?.pix_qr_code_base64 || ''
    const exp = next?.pix_expires_at || ''
    return { id: pi.id, qr_code: String(qr), qr_code_base64: b64 ? String(b64) : undefined, expires_at: exp ? String(exp) : undefined, status: pi.status }
  }
  async createBoletoPayment(amount: number, dueDate: Date, metadata: any): Promise<BoletoData> {
    const pi = await this.stripe.paymentIntents.create({ amount, currency: 'brl', payment_method_types: ['boleto'], payment_method_options: { boleto: { expires_after_days: 7 } }, metadata })
    const next = (pi as any).next_action || {}
    const url = next?.boleto_display_details?.hosted_voucher_url || ''
    const barcode = next?.boleto_display_details?.number || ''
    return { id: pi.id, boleto_url: String(url), barcode: barcode ? String(barcode) : undefined, due_date: dueDate.toISOString(), status: pi.status }
  }
  async handleWebhook(event: any): Promise<void> { }
}

class MercadoPagoGateway implements PaymentGateway {
  sdk: any
  constructor(token: string) { }
  async init() { if (!this.sdk) { const mp = await import('mercadopago') as any; mp.configure({ access_token: env.MERCADOPAGO_ACCESS_TOKEN }); this.sdk = mp } }
  async createPaymentIntent(amount: number, currency: string, metadata: any): Promise<PaymentIntent> {
    await this.init()
    const pref = await this.sdk.preferences.create({ items: [{ title: metadata?.description || 'Pagamento', quantity: 1, currency_id: String(currency).toUpperCase(), unit_price: amount / 100 }], metadata })
    return { id: String(pref?.body?.id), init_point: String(pref?.body?.init_point || ''), sandbox_init_point: String(pref?.body?.sandbox_init_point || ''), status: 'pending', provider: 'mercadopago' }
  }
  async confirmPayment(paymentIntentId: string): Promise<PaymentStatus> {
    await this.init()
    const pay = await this.sdk.payment.get(paymentIntentId)
    const st = pay?.body?.status
    const status = st === 'approved' ? 'succeeded' : st || 'pending'
    const receipt = pay?.body?.receipt_url || undefined
    return { status, receipt_url: receipt }
  }
  async createPixPayment(amount: number, metadata: any): Promise<PixData> {
    await this.init()
    const res = await this.sdk.payment.create({ transaction_amount: amount / 100, description: metadata?.description || 'PIX', payment_method_id: 'pix' })
    const td = res?.body?.point_of_interaction?.transaction_data || {}
    const id = String(res?.body?.id)
    const qr = String(td?.qr_code || '')
    const b64 = String(td?.qr_code_base64 || '')
    const exp = String(td?.expiration_date || '')
    const st = String(res?.body?.status || 'pending')
    return { id, qr_code: qr, qr_code_base64: b64 || undefined, expires_at: exp || undefined, status: st }
  }
  async createBoletoPayment(amount: number, dueDate: Date, metadata: any): Promise<BoletoData> {
    await this.init()
    const res = await this.sdk.payment.create({ transaction_amount: amount / 100, description: metadata?.description || 'Boleto', payment_method_id: 'ticket' })
    const id = String(res?.body?.id)
    const url = String(res?.body?.transaction_details?.external_resource_url || '')
    const barcode = String(res?.body?.barcode?.content || '')
    const st = String(res?.body?.status || 'pending')
    return { id, boleto_url: url, barcode: barcode || undefined, due_date: dueDate.toISOString(), status: st }
  }
  async handleWebhook(event: any): Promise<void> { }
}

export function getPaymentGateway(provider: 'stripe' | 'mercadopago'): PaymentGateway {
  if (provider === 'mercadopago' && env.MERCADOPAGO_ACCESS_TOKEN) return new MercadoPagoGateway(env.MERCADOPAGO_ACCESS_TOKEN)
  if (env.STRIPE_SECRET_KEY) return new StripeGateway(env.STRIPE_SECRET_KEY)
  return new StripeGateway('')
}