import PDFDocument from 'pdfkit'
import { pg } from '../config/postgres'
import { env } from '../config/env'

export type FinancialReportParams = { from?: Date; to?: Date; status?: string[]; limit?: number }
export type UserReportParams = { from?: Date; to?: Date; limit?: number }
export type ServiceReportParams = { status?: string; limit?: number }

export interface ReportService {
  generateFinancialReport(parameters: FinancialReportParams): Promise<Buffer>
  generateUserReport(parameters: UserReportParams): Promise<Buffer>
  generateServiceReport(parameters: ServiceReportParams): Promise<Buffer>
  getReportFormats(): string[]
}

function newDoc(title: string) {
  const doc = new PDFDocument()
  const chunks: Buffer[] = []
  doc.on('data', d => chunks.push(d))
  doc.fontSize(20).text(title)
  doc.moveDown()
  return { doc, chunks }
}

class DefaultReportService implements ReportService {
  async generateFinancialReport(parameters: FinancialReportParams) {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const { doc, chunks } = newDoc('Relatório Financeiro')
    const where: string[] = ["status IN ('succeeded','approved','paid')"]
    const values: any[] = []
    if (parameters.from) { values.push(parameters.from); where.push(`created_at >= $${values.length}`) }
    if (parameters.to) { values.push(parameters.to); where.push(`created_at <= $${values.length}`) }
    const sql = `SELECT id, amount, currency, provider, status, created_at FROM payments WHERE ${where.join(' AND ')} ORDER BY created_at DESC ${parameters.limit ? `LIMIT ${parameters.limit}` : ''}`
    const q = await pg.query(sql, values)
    const sum = q.rows.reduce((a, r) => a + Number(r.amount), 0)
    doc.fontSize(12).text(`Pagamentos: ${q.rows.length}`)
    doc.text(`Total (centavos): ${sum}`)
    doc.moveDown()
    for (const r of q.rows) { doc.text(`${new Date(r.created_at as any).toLocaleString()} | ${r.provider} | ${r.currency} ${Number(r.amount)}`) }
    await new Promise<void>(resolve => { doc.on('end', () => resolve()); doc.end() })
    return Buffer.concat(chunks)
  }
  async generateUserReport(parameters: UserReportParams) {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const { doc, chunks } = newDoc('Relatório de Usuários')
    const where: string[] = []
    const values: any[] = []
    if (parameters.from) { values.push(parameters.from); where.push(`created_at >= $${values.length}`) }
    if (parameters.to) { values.push(parameters.to); where.push(`created_at <= $${values.length}`) }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = await pg.query(`SELECT COUNT(*)::int AS c FROM users ${whereSql}`, values)
    const list = await pg.query(`SELECT id, email, name, user_type, created_at FROM users ${whereSql} ORDER BY created_at DESC ${parameters.limit ? `LIMIT ${parameters.limit}` : ''}`, values)
    doc.fontSize(12).text(`Total de usuários: ${total.rows[0]?.c || 0}`)
    doc.moveDown()
    for (const u of list.rows) { doc.text(`${new Date(u.created_at as any).toLocaleString()} | ${u.email} | ${u.name || ''} | ${u.user_type}`) }
    await new Promise<void>(resolve => { doc.on('end', () => resolve()); doc.end() })
    return Buffer.concat(chunks)
  }
  async generateServiceReport(parameters: ServiceReportParams) {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const { doc, chunks } = newDoc('Relatório de Serviços')
    const where: string[] = []
    const values: any[] = []
    if (parameters.status) { values.push(parameters.status); where.push(`status = $${values.length}`) }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = await pg.query(`SELECT COUNT(*)::int AS c FROM mei_services ${whereSql}`, values)
    const list = await pg.query(`SELECT id, user_id, cnpj, company_name, status, opened_date, created_at FROM mei_services ${whereSql} ORDER BY created_at DESC ${parameters.limit ? `LIMIT ${parameters.limit}` : ''}`, values)
    doc.fontSize(12).text(`Total de serviços MEI: ${total.rows[0]?.c || 0}`)
    doc.moveDown()
    for (const s of list.rows) { doc.text(`${new Date(s.created_at as any).toLocaleString()} | ${s.status} | ${s.company_name} | ${s.cnpj || ''}`) }
    await new Promise<void>(resolve => { doc.on('end', () => resolve()); doc.end() })
    return Buffer.concat(chunks)
  }
  getReportFormats() { return ['pdf','csv'] }
}

export function getReportService(): ReportService { return new DefaultReportService() }