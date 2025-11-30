import { Router } from 'express'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import Joi from 'joi'
import { validate } from '../middlewares/validate'
import { env } from '../config/env'

function onlyDigits(s: string) { return s.replace(/\D/g, '') }
function validCPF(cpf: string) {
  const s = onlyDigits(cpf)
  if (s.length !== 11 || /^([0-9])\1{10}$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(s[i]) * (10 - i)
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0
  if (d1 !== parseInt(s[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(s[i]) * (11 - i)
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0
  return d2 === parseInt(s[10])
}
function validCNPJ(cnpj: string) {
  const s = onlyDigits(cnpj)
  if (s.length !== 14 || /^([0-9])\1{13}$/.test(s)) return false
  const calc = (base: number) => {
    let size = base === 12 ? 12 : 13
    let sum = 0
    let pos = base === 12 ? 5 : 6
    for (let i = 0; i < size; i++) {
      sum += parseInt(s[i]) * pos
      pos = pos === 2 ? 9 : pos - 1
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = calc(12)
  const d2 = calc(13)
  return d1 === parseInt(s[12]) && d2 === parseInt(s[13])
}

const router = Router()

router.get('/profile', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const q = 'SELECT id, email, name, user_type, phone, cpf, cnpj, address_street, address_city, address_state, address_cep, subscription_plan, subscription_status, stripe_customer_id, current_period_end, email_notifications, email_marketing, created_at, updated_at, last_login FROM users WHERE id=$1'
  const { rows } = await pg.query(q, [uid])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  return res.json(rows[0])
})

const profileSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  phone: Joi.string().optional(),
  cpf: Joi.string().optional(),
  cnpj: Joi.string().optional(),
  address_street: Joi.string().optional(),
  address_city: Joi.string().optional(),
  address_state: Joi.string().length(2).optional(),
  address_cep: Joi.string().optional(),
  email_notifications: Joi.boolean().optional(),
  email_marketing: Joi.boolean().optional()
})

router.put('/profile', requireAuth, validate(profileSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { cpf, cnpj } = req.body
  if (cpf && !validCPF(cpf)) return res.status(400).json({ error: 'invalid_cpf' })
  if (cnpj && !validCNPJ(cnpj)) return res.status(400).json({ error: 'invalid_cnpj' })
  const fields = ['name','phone','cpf','cnpj','address_street','address_city','address_state','address_cep','email_notifications','email_marketing']
  const updates: string[] = []
  const values: any[] = []
  fields.forEach((f, i) => {
    if (req.body[f] !== undefined) { updates.push(`${f}=$${updates.length+1}`); values.push(req.body[f]) }
  })
  if (!updates.length) return res.json({ ok: true })
  values.push(uid)
  const sql = `UPDATE users SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`
  await pg.query(sql, values)
  return res.json({ ok: true })
})

router.get('/subscription', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { rows } = await pg.query('SELECT subscription_plan, subscription_status, stripe_customer_id, current_period_end FROM users WHERE id=$1', [uid])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  return res.json(rows[0])
})

const subSchema = Joi.object({ plan: Joi.string().valid('free','mei','premium').required(), priceId: Joi.string().optional() })
router.post('/subscription', requireAuth, validate(subSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { plan, priceId } = req.body
  const userRes = await pg.query('SELECT email, stripe_customer_id FROM users WHERE id=$1', [uid])
  if (!userRes.rows.length) return res.status(404).json({ error: 'not_found' })
  const email = userRes.rows[0].email as string
  let stripeCustomer = userRes.rows[0].stripe_customer_id as string | null
  let periodEnd: Date | null = null
  if (env.STRIPE_SECRET_KEY && priceId) {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    if (!stripeCustomer) {
      const customer = await stripe.customers.create({ email })
      stripeCustomer = customer.id
      await pg.query('UPDATE users SET stripe_customer_id=$1 WHERE id=$2', [stripeCustomer, uid])
    }
    const subscription = await stripe.subscriptions.create({ customer: stripeCustomer, items: [{ price: priceId }], expand: ['latest_invoice.payment_intent'] })
    periodEnd = new Date((subscription as any).data.current_period_end * 1000)
  }
  await pg.query('UPDATE users SET subscription_plan=$1, subscription_status=$2, current_period_end=$3 WHERE id=$4', [plan, 'active', periodEnd, uid])
  return res.json({ ok: true })
})

router.delete('/subscription', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const userRes = await pg.query('SELECT stripe_customer_id FROM users WHERE id=$1', [uid])
  if (!userRes.rows.length) return res.status(404).json({ error: 'not_found' })
  const stripeCustomer = userRes.rows[0].stripe_customer_id as string | null
  if (env.STRIPE_SECRET_KEY && stripeCustomer) {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(env.STRIPE_SECRET_KEY)
    const subs = await stripe.subscriptions.list({ customer: stripeCustomer, status: 'active' })
    for (const s of subs.data) { await stripe.subscriptions.cancel(s.id) }
  }
  await pg.query('UPDATE users SET subscription_status=$1 WHERE id=$2', ['canceled', uid])
  return res.json({ ok: true })
})

export default router