import { pg } from '../config/postgres'
import { env } from '../config/env'
import { getStorageService } from '../services/storage'
import { randomBytes, createHash, createCipheriv } from 'crypto'
import { gzipSync } from 'zlib'

function fmt(ts: Date) {
  const yyyy = ts.getFullYear()
  const mm = String(ts.getMonth() + 1).padStart(2, '0')
  const dd = String(ts.getDate()).padStart(2, '0')
  const hh = String(ts.getHours()).padStart(2, '0')
  const mi = String(ts.getMinutes()).padStart(2, '0')
  const ss = String(ts.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`
}

async function exportCriticalData() {
  const res: Record<string, any> = {}
  const tables = [
    'users','curricula','appointments','payments','mei_services','mei_invoices','mei_nfes',
    'notifications','support_tickets','ticket_messages','reports'
  ]
  for (const t of tables) {
    const q = await pg.query(`SELECT * FROM ${t}`)
    res[t] = q.rows
  }
  return res
}

function encrypt(data: Buffer) {
  const secret = env.BACKUP_SECRET || env.JWT_SECRET
  const key = createHash('sha256').update(secret).digest() // 32 bytes
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const enc = Buffer.concat([cipher.update(data), cipher.final()])
  return Buffer.concat([iv, enc])
}

export async function backupJob() {
  if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
  const storage = getStorageService()
  const ts = new Date()
  const name = fmt(ts)
  const data = await exportCriticalData()
  const json = Buffer.from(JSON.stringify({ generated_at: ts.toISOString(), data }), 'utf8')
  const gz = gzipSync(json)
  const enc = encrypt(gz)
  const url = await storage.uploadFile(enc, `backup/${name}_backup.bin`, 'application/octet-stream')
  return { url, size: enc.length }
}