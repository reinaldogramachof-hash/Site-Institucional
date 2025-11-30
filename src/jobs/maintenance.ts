import { pg } from '../config/postgres'
import { env } from '../config/env'
import { getStorageService } from '../services/storage'

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

async function cleanupLogs() {
  if (!env.PG_CONNECTION_STRING) return
  await pg.query("DELETE FROM admin_logs WHERE created_at < NOW() - INTERVAL '90 days'")
}

async function cleanupCache() {
  if (!env.REDIS_URL) return
  const Redis = (await import('ioredis')).default
  const redis = new Redis(env.REDIS_URL)
  const stream = redis.scanStream({ match: 'cache:*', count: 100 })
  const keys: string[] = []
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (k: string[]) => { keys.push(...k) })
    stream.on('end', () => resolve())
    stream.on('error', err => reject(err))
  })
  if (keys.length) await redis.del(...keys)
  await redis.quit()
}

async function archiveInactiveData() {
  if (!env.PG_CONNECTION_STRING) return
  const storage = getStorageService()
  const now = new Date()
  const ymd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const tickets = await pg.query("SELECT id, user_id, subject, status, priority, assigned_to, updated_at FROM support_tickets WHERE status='closed' AND updated_at < NOW() - INTERVAL '180 days' ORDER BY updated_at DESC")
  if (tickets.rows.length) {
    const buf = toCSV(tickets.rows, [
      { key: 'id', title: 'id' },
      { key: 'user_id', title: 'user_id' },
      { key: 'subject', title: 'subject' },
      { key: 'status', title: 'status' },
      { key: 'priority', title: 'priority' },
      { key: 'assigned_to', title: 'assigned_to' },
      { key: 'updated_at', title: 'updated_at' }
    ])
    await storage.uploadFile(buf, `archive/${ymd}_support_tickets.csv`, 'text/csv')
  }
  const notifications = await pg.query("SELECT id, user_id, title, message, type, created_at FROM notifications WHERE is_read=true AND created_at < NOW() - INTERVAL '180 days' ORDER BY created_at DESC")
  if (notifications.rows.length) {
    const buf = toCSV(notifications.rows, [
      { key: 'id', title: 'id' },
      { key: 'user_id', title: 'user_id' },
      { key: 'title', title: 'title' },
      { key: 'message', title: 'message' },
      { key: 'type', title: 'type' },
      { key: 'created_at', title: 'created_at' }
    ])
    await storage.uploadFile(buf, `archive/${ymd}_notifications.csv`, 'text/csv')
  }
}

export async function cleanupJob() {
  await cleanupLogs()
  await cleanupCache()
  await archiveInactiveData()
}