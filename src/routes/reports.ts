import { Router } from 'express'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import { env } from '../config/env'
import { getStorageService } from '../services/storage'
import { generateReportJob } from '../jobs/reports'

const router = Router()

function toTitle(t: string) {
  const map: Record<string, string> = { financeiro: 'Relatório Financeiro', usuarios: 'Relatório de Usuários', servicos: 'Relatório de Serviços' }
  return map[t] || t
}

router.get('/', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const q = await pg.query('SELECT id, title, description, report_type, status, created_at, completed_at, file_url FROM reports WHERE generated_by=$1 ORDER BY created_at DESC', [uid])
  res.json({ reports: q.rows })
})

router.post('/generate', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const type = String((req.body?.report_type || '').toLowerCase())
  if (!['financeiro','usuarios','servicos'].includes(type)) return res.status(400).json({ error: 'invalid_type' })
  const params = req.body?.parameters || null
  const title = toTitle(type)
  const ins = await pg.query('INSERT INTO reports (title, description, report_type, parameters, generated_by, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [title, '', type, params ? JSON.stringify(params) : null, uid, 'pending'])
  const id = ins.rows[0]?.id as string
  setImmediate(() => { generateReportJob(id).catch(() => {}) })
  res.status(202).json({ id, status: 'pending' })
})

router.get('/:id', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = req.params.id
  const r = await pg.query('SELECT * FROM reports WHERE id=$1', [id])
  if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
  const row = r.rows[0]
  const role = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
  const isAdmin = role.rows[0]?.user_type === 'admin'
  if (row.generated_by !== uid && !isAdmin) return res.status(403).json({ error: 'forbidden' })
  res.json(row)
})

router.get('/:id/download', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = req.params.id
  const r = await pg.query('SELECT file_url, generated_by FROM reports WHERE id=$1', [id])
  if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
  const row = r.rows[0]
  const role = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
  const isAdmin = role.rows[0]?.user_type === 'admin'
  if (row.generated_by !== uid && !isAdmin) return res.status(403).json({ error: 'forbidden' })
  if (!row.file_url) return res.status(409).json({ error: 'not_ready' })
  const storage = getStorageService()
  const url = await storage.getSignedUrl(row.file_url as string)
  res.json({ url })
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = req.params.id
  const r = await pg.query('SELECT file_url, generated_by FROM reports WHERE id=$1', [id])
  if (!r.rows.length) return res.status(404).json({ error: 'not_found' })
  const row = r.rows[0]
  const role = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
  const isAdmin = role.rows[0]?.user_type === 'admin'
  if (row.generated_by !== uid && !isAdmin) return res.status(403).json({ error: 'forbidden' })
  const storage = getStorageService()
  if (row.file_url) await storage.deleteFile(row.file_url as string)
  await pg.query('DELETE FROM reports WHERE id=$1', [id])
  res.json({ deleted: true })
})

export default router