import { pg } from '../config/postgres'
import { env } from '../config/env'

export interface MEIRegistrationData {
  user_id: string
  cnpj: string
  company_name: string
  activity_code: string
  activity_description: string
  opened_date?: string
  business_address_street?: string
  business_address_number?: string
  business_address_complement?: string
  business_address_city?: string
  business_address_state?: string
  business_address_cep?: string
}

export interface DASData {
  id: string
  mei_service_id: string
  reference_month: string
  due_date: string
  amount: number
  status: string
  barcode?: string
}

export interface NFeData {
  mei_service_id: string
  value: number
  client_name: string
  client_cpf_cnpj?: string
  service_description?: string
  issue_date?: string
}

export interface MEIService {
  validateCNPJ(cnpj: string): Promise<boolean>
  registerMEI(data: MEIRegistrationData): Promise<{ success: boolean; message: string }>
  generateDAS(meiServiceId: string, month: string): Promise<DASData>
  issueNFe(data: NFeData): Promise<{ success: boolean; nfeNumber: string }>
  submitAnnualDeclaration(meiServiceId: string, year: number): Promise<{ success: boolean }>
}

function onlyDigits(s: string) { return s.replace(/\D/g, '') }
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

export function validateCNPJ(cnpj: string): boolean { return validCNPJ(cnpj) }

class DefaultMEIService implements MEIService {
  async validateCNPJ(cnpj: string) { return validCNPJ(cnpj) }
  async registerMEI(data: MEIRegistrationData) {
    if (!validCNPJ(data.cnpj)) return { success: false, message: 'invalid_cnpj' }
    const exists = await pg.query('SELECT id FROM mei_services WHERE cnpj=$1', [data.cnpj])
    if (exists.rows.length) return { success: false, message: 'cnpj_exists' }
    const fields = [
      'user_id','cnpj','company_name','activity_code','activity_description','opened_date',
      'business_address_street','business_address_number','business_address_complement',
      'business_address_city','business_address_state','business_address_cep'
    ]
    const values = [
      data.user_id, data.cnpj, data.company_name, data.activity_code, data.activity_description, data.opened_date || null,
      data.business_address_street || null, data.business_address_number || null, data.business_address_complement || null,
      data.business_address_city || null, data.business_address_state || null, data.business_address_cep || null
    ]
    const placeholders = values.map((_, i) => `$${i+1}`).join(',')
    const sql = `INSERT INTO mei_services (${fields.join(',')}) VALUES (${placeholders})`
    await pg.query(sql, values)
    return { success: true, message: 'registered' }
  }
  async generateDAS(meiServiceId: string, month: string) {
    const m = month
    const ref = await pg.query('SELECT id FROM mei_invoices WHERE mei_service_id=$1 AND reference_month=$2', [meiServiceId, m])
    if (ref.rows.length) {
      const row = await pg.query('SELECT * FROM mei_invoices WHERE id=$1', [ref.rows[0].id])
      const r = row.rows[0]
      return { id: r.id, mei_service_id: r.mei_service_id, reference_month: r.reference_month, due_date: String(r.due_date), amount: Number(r.amount), status: r.status, barcode: r.barcode || undefined }
    }
    const d = new Date(m + '-20T00:00:00')
    const amt = 7000
    const barcode = Math.random().toString().slice(2, 14)
    const ins = await pg.query('INSERT INTO mei_invoices (mei_service_id, reference_month, due_date, amount, status, barcode) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [meiServiceId, m, d, amt / 100, 'pending', barcode])
    const r = ins.rows[0]
    return { id: r.id, mei_service_id: r.mei_service_id, reference_month: r.reference_month, due_date: String(r.due_date), amount: Number(r.amount), status: r.status, barcode: r.barcode || undefined }
  }
  async issueNFe(data: NFeData) {
    const num = 'NFE-' + Date.now()
    const ins = await pg.query('INSERT INTO mei_nfes (mei_service_id, number, value, client_name, client_cpf_cnpj, service_description, issue_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING number', [
      data.mei_service_id, num, data.value, data.client_name, data.client_cpf_cnpj || null, data.service_description || null, data.issue_date ? new Date(data.issue_date) : new Date(), 'issued'
    ])
    return { success: true, nfeNumber: ins.rows[0].number }
  }
  async submitAnnualDeclaration(meiServiceId: string, year: number) {
    const existing = await pg.query('SELECT id FROM mei_annual_declarations WHERE mei_service_id=$1 AND reference_year=$2', [meiServiceId, year])
    if (existing.rows.length) {
      await pg.query('UPDATE mei_annual_declarations SET status=$1, submitted_at=NOW(), updated_at=NOW() WHERE id=$2', ['submitted', existing.rows[0].id])
      return { success: true }
    }
    await pg.query('INSERT INTO mei_annual_declarations (mei_service_id, reference_year, status, submitted_at) VALUES ($1,$2,$3,$4)', [meiServiceId, year, 'submitted', new Date()])
    return { success: true }
  }
}

export function getMEIService(): MEIService { return new DefaultMEIService() }

async function sendEmail(to: string, subject: string, text: string) {
  if (env.SENDGRID_API_KEY) {
    const sg = await import('@sendgrid/mail')
    ;(sg as any).setApiKey(env.SENDGRID_API_KEY)
    await (sg as any).send({ to, from: env.SMTP_FROM || env.SMTP_USER, subject, text })
    return
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const nodemailer = await import('nodemailer') as any
    const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
    await transporter.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, text })
    return
  }
}

export async function generateMonthlyDAS() {
  if (!env.PG_CONNECTION_STRING) return
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const services = await pg.query("SELECT id, user_id, company_name FROM mei_services WHERE status='active'")
  for (const s of services.rows) {
    const exists = await pg.query('SELECT id FROM mei_invoices WHERE mei_service_id=$1 AND reference_month=$2', [s.id, ym])
    if (exists.rows.length) continue
    const das = await getMEIService().generateDAS(s.id as string, ym)
    const u = await pg.query('SELECT email, name FROM users WHERE id=$1', [s.user_id])
    const email = u.rows[0]?.email
    const name = u.rows[0]?.name || ''
    if (email) {
      const subject = `DAS ${das.reference_month} gerado`
      const text = `Olá ${name}, geramos o DAS de ${das.reference_month} para ${s.company_name}. Valor: R$ ${das.amount.toFixed(2)}. Vencimento: ${new Date(das.due_date).toLocaleDateString()}.`
      await sendEmail(email, subject, text)
    }
  }
}

export async function checkOverduePayments() {
  if (!env.PG_CONNECTION_STRING) return
  const q = await pg.query(
    "SELECT mi.id, mi.reference_month, mi.due_date, mi.amount, ms.company_name, u.email, u.name FROM mei_invoices mi JOIN mei_services ms ON mi.mei_service_id=ms.id JOIN users u ON u.id=ms.user_id WHERE mi.status='pending' AND mi.due_date < CURRENT_DATE"
  )
  for (const row of q.rows) {
    await pg.query("UPDATE mei_invoices SET status='overdue', updated_at=NOW() WHERE id=$1", [row.id])
    const email = row.email
    if (email) {
      const subject = `DAS em atraso (${row.reference_month})`
      const text = `Olá ${row.name}, o DAS de ${row.reference_month} para ${row.company_name} está em atraso desde ${new Date(row.due_date).toLocaleDateString()}. Valor: R$ ${Number(row.amount).toFixed(2)}.`
      await sendEmail(email, subject, text)
    }
  }
}