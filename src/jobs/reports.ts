import { pg } from '../config/postgres'
import { env } from '../config/env'
import { getStorageService } from '../services/storage'
import { getReportService } from '../services/report'

function toTitle(t: string) {
  const map: Record<string, string> = { financeiro: 'Relatório Financeiro', usuarios: 'Relatório de Usuários', servicos: 'Relatório de Serviços' }
  return map[t] || t
}

function toCSV(rows: any[], columns: { key: string; title: string }[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const header = columns.map(c => c.title).join(',')
  const lines = rows.map(r => columns.map(c => esc(r[c.key])).join(','))
  return Buffer.from([header, ...lines].join('\n'), 'utf8')
}

export async function generateReportJob(reportId: string) {
  if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
  const sel = await pg.query('SELECT id, report_type, parameters, generated_by FROM reports WHERE id=$1', [reportId])
  if (!sel.rows.length) return
  const row = sel.rows[0]
  const type = String(row.report_type).toLowerCase()
  let params: any = {}
  try { params = row.parameters ? JSON.parse(String(row.parameters)) : {} } catch {}
  const format = String(params?.format || 'pdf').toLowerCase()
  await pg.query('UPDATE reports SET status=$1, updated_at=NOW() WHERE id=$2', ['processing', reportId])
  try {
    const storage = getStorageService()
    let buf: Buffer
    let filename: string
    if (format === 'csv') {
      if (type === 'financeiro') {
        const where: string[] = ["status IN ('succeeded','approved','paid')"]
        const values: any[] = []
        if (params.de) { values.push(new Date(params.de)); where.push(`created_at >= $${values.length}`) }
        if (params.ate) { values.push(new Date(params.ate)); where.push(`created_at <= $${values.length}`) }
        const sql = `SELECT id, amount, currency, provider, status, created_at FROM payments WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 100`
        const q = await pg.query(sql, values)
        buf = toCSV(q.rows, [
          { key: 'created_at', title: 'created_at' },
          { key: 'provider', title: 'provider' },
          { key: 'currency', title: 'currency' },
          { key: 'amount', title: 'amount' },
          { key: 'status', title: 'status' },
          { key: 'id', title: 'id' }
        ])
        filename = `reports/${reportId}.csv`
      } else if (type === 'usuarios') {
        const where: string[] = []
        const values: any[] = []
        if (params.de) { values.push(new Date(params.de)); where.push(`created_at >= $${values.length}`) }
        if (params.ate) { values.push(new Date(params.ate)); where.push(`created_at <= $${values.length}`) }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
        const q = await pg.query(`SELECT id, email, name, user_type, created_at FROM users ${whereSql} ORDER BY created_at DESC LIMIT 200`, values)
        buf = toCSV(q.rows, [
          { key: 'created_at', title: 'created_at' },
          { key: 'email', title: 'email' },
          { key: 'name', title: 'name' },
          { key: 'user_type', title: 'user_type' },
          { key: 'id', title: 'id' }
        ])
        filename = `reports/${reportId}.csv`
      } else if (type === 'servicos') {
        const where: string[] = []
        const values: any[] = []
        if (params.status) { values.push(String(params.status)); where.push(`status = $${values.length}`) }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
        const q = await pg.query(`SELECT id, user_id, cnpj, company_name, status, opened_date, created_at FROM mei_services ${whereSql} ORDER BY created_at DESC LIMIT 200`, values)
        buf = toCSV(q.rows, [
          { key: 'created_at', title: 'created_at' },
          { key: 'status', title: 'status' },
          { key: 'company_name', title: 'company_name' },
          { key: 'cnpj', title: 'cnpj' },
          { key: 'user_id', title: 'user_id' },
          { key: 'id', title: 'id' }
        ])
        filename = `reports/${reportId}.csv`
      } else {
        buf = Buffer.from('', 'utf8')
        filename = `reports/${reportId}.csv`
      }
      const url = await storage.uploadFile(buf, filename, 'text/csv')
      await pg.query('UPDATE reports SET file_url=$1, status=$2, completed_at=NOW() WHERE id=$3', [url, 'completed', reportId])
    } else {
      const svc = getReportService()
      if (type === 'financeiro') buf = await svc.generateFinancialReport({ from: params.de ? new Date(params.de) : undefined, to: params.ate ? new Date(params.ate) : undefined })
      else if (type === 'usuarios') buf = await svc.generateUserReport({ from: params.de ? new Date(params.de) : undefined, to: params.ate ? new Date(params.ate) : undefined })
      else buf = await svc.generateServiceReport({ status: params.status })
      filename = `reports/${reportId}.pdf`
      const url = await storage.uploadFile(buf, filename, 'application/pdf')
      await pg.query('UPDATE reports SET file_url=$1, status=$2, completed_at=NOW() WHERE id=$3', [url, 'completed', reportId])
    }
  } catch {
    await pg.query('UPDATE reports SET status=$1, updated_at=NOW() WHERE id=$2', ['failed', reportId])
  }
}