import { Router } from 'express'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import { env } from '../config/env'
import { notificationEvents } from '../services/events'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSizeRaw = Number(req.query.pageSize) || 20
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw))
  const offset = (page - 1) * pageSize
  const totalRes = await pg.query('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1', [uid])
  const rowsRes = await pg.query('SELECT id, title, message, type, related_service, related_id, is_read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [uid, pageSize, offset])
  const total = totalRes.rows[0]?.c || 0
  const hasMore = offset + rowsRes.rows.length < total
  res.json({ items: rowsRes.rows, page, pageSize, total, hasMore })
})

router.put('/:id/read', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = req.params.id
  const q = await pg.query('UPDATE notifications SET is_read=true, updated_at=NOW() WHERE id=$1 AND user_id=$2 AND is_read=false', [id, uid])
  res.json({ updated: Number(q.rowCount || 0) > 0 })
})

router.put('/read-all', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const q = await pg.query('UPDATE notifications SET is_read=true, updated_at=NOW() WHERE user_id=$1 AND is_read=false', [uid])
  res.json({ updated_count: q.rowCount })
})

router.get('/unread-count', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const q = await pg.query('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1 AND is_read=false', [uid])
  res.json({ count: q.rows[0]?.c || 0 })
})

export default router

// SSE stream de notificações
router.get('/stream', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  const send = (data: any) => { res.write(`data: ${JSON.stringify(data)}\n\n`) }
  const handler = (payload: any) => send({ type: 'notification', payload })
  notificationEvents.on(`user:${uid}`, handler)
  req.on('close', () => { notificationEvents.off(`user:${uid}`, handler) })
})