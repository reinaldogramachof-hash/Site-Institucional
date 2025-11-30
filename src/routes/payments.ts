import { Router } from 'express'
import Joi from 'joi'
import { validate } from '../middlewares/validate'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import { env } from '../config/env'

const router = Router()

const intentSchema = Joi.object({
  amount: Joi.number().integer().min(100).required(),
  currency: Joi.string().default('brl'),
  description: Joi.string().max(255).optional(),
  provider: Joi.string().valid('stripe','mercadopago').default('stripe')
})

router.post('/create-intent', requireAuth, validate(intentSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'service_unavailable' })
  const uid = (req as any).userId as string
  const { amount, currency, description, provider } = req.body
  if (provider === 'stripe') {
    if (!env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'provider_unavailable' })
    const stripe = new (require('stripe'))(env.STRIPE_SECRET_KEY)
    const pi = await stripe.paymentIntents.create({ amount, currency, description, automatic_payment_methods: { enabled: true } })
    const ins = `INSERT INTO payments (user_id, amount, currency, description, status, provider, provider_payment_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`
    const { rows } = await pg.query(ins, [uid, amount, currency, description || null, pi.status, 'stripe', pi.id])
    return res.json({ id: rows[0].id, client_secret: pi.client_secret, provider: 'stripe' })
  } else {
    if (!env.MERCADOPAGO_ACCESS_TOKEN) return res.status(503).json({ error: 'provider_unavailable' })
    const mp = await import('mercadopago') as any
    mp.configure({ access_token: env.MERCADOPAGO_ACCESS_TOKEN })
    const pref = await mp.preferences.create({ items: [{ title: description || 'Pagamento', quantity: 1, currency_id: String(currency).toUpperCase(), unit_price: amount / 100 }] })
    const ins = `INSERT INTO payments (user_id, amount, currency, description, status, provider, provider_payment_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`
    const { rows } = await pg.query(ins, [uid, amount, currency, description || null, 'pending', 'mercadopago', pref?.body?.id])
    return res.json({ id: rows[0].id, init_point: pref?.body?.init_point, sandbox_init_point: pref?.body?.sandbox_init_point, provider: 'mercadopago' })
  }
})

router.get('/', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { rows } = await pg.query('SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC', [uid])
  return res.json({ items: rows })
})

router.get('/history', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { rows } = await pg.query('SELECT * FROM payments WHERE user_id=$1 ORDER BY created_at DESC', [uid])
  return res.json({ items: rows })
})

const confirmSchema = Joi.object({
  provider: Joi.string().valid('stripe','mercadopago').required(),
  provider_payment_id: Joi.string().required()
})

router.post('/confirm', requireAuth, validate(confirmSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { provider, provider_payment_id } = req.body
  let status = 'pending'
  let receipt_url: string | null = null
  if (provider === 'stripe' && env.STRIPE_SECRET_KEY) {
    const stripe = new (require('stripe'))(env.STRIPE_SECRET_KEY)
    const pi = await stripe.paymentIntents.retrieve(provider_payment_id)
    status = pi.status
    try {
      const charges = (pi as any).charges?.data || []
      if (charges.length) receipt_url = charges[0]?.receipt_url || null
    } catch {}
  } else if (provider === 'mercadopago' && env.MERCADOPAGO_ACCESS_TOKEN) {
    const mp = await import('mercadopago') as any
    mp.configure({ access_token: env.MERCADOPAGO_ACCESS_TOKEN })
    const pay = await mp.payment.get(provider_payment_id)
    const st = pay?.body?.status
    status = st === 'approved' ? 'succeeded' : st || 'pending'
    receipt_url = pay?.body?.receipt_url || null
  } else {
    return res.status(503).json({ error: 'provider_unavailable' })
  }
  await pg.query('UPDATE payments SET status=$1, receipt_url=$2, updated_at=NOW() WHERE provider=$3 AND provider_payment_id=$4', [status, receipt_url, provider, provider_payment_id])
  return res.json({ ok: true, status })
})

router.post('/webhook/stripe', async (req, res) => {
  if (!env.PG_CONNECTION_STRING || !env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'service_unavailable' })
  const stripe = new (require('stripe'))(env.STRIPE_SECRET_KEY)
  let event: any = req.body
  try {
    const sig = (req as any).headers['stripe-signature']
    if (env.STRIPE_WEBHOOK_SECRET && sig) event = stripe.webhooks.constructEvent((req as any).rawBody || JSON.stringify(req.body), sig, env.STRIPE_WEBHOOK_SECRET)
  } catch { return res.status(400).send('invalid') }
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object
    await pg.query('UPDATE payments SET status=$1, updated_at=NOW() WHERE provider=$2 AND provider_payment_id=$3', [pi.status, 'stripe', pi.id])
  }
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object
    await pg.query('UPDATE payments SET status=$1, updated_at=NOW() WHERE provider=$2 AND provider_payment_id=$3', [pi.status, 'stripe', pi.id])
  }
  return res.json({ received: true })
})

router.post('/webhook/mercadopago', async (req, res) => {
  if (!env.PG_CONNECTION_STRING || !env.MERCADOPAGO_ACCESS_TOKEN) return res.status(503).json({ error: 'service_unavailable' })
  const mp = await import('mercadopago') as any
  mp.configure({ access_token: env.MERCADOPAGO_ACCESS_TOKEN })
  const paymentId = req.body?.data?.id || req.query?.id
  if (!paymentId) return res.json({ ok: true })
  try {
    const pay = await mp.payment.get(paymentId)
    const st = pay?.body?.status
    const status = st === 'approved' ? 'succeeded' : st || 'pending'
    await pg.query('UPDATE payments SET status=$1, updated_at=NOW() WHERE provider=$2 AND provider_payment_id=$3', [status, 'mercadopago', String(paymentId)])
  } catch {}
  return res.json({ received: true })
})

export default router