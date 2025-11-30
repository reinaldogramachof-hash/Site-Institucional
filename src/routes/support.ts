import { Router } from 'express'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import { env } from '../config/env'

const router = Router()

async function isAdmin(userId: string) {
  const role = await pg.query('SELECT user_type FROM users WHERE id=$1', [userId])
  return role.rows[0]?.user_type === 'admin'
}

router.get('/tickets', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const admin = await isAdmin(uid)
  if (admin) {
    const q = await pg.query('SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at FROM support_tickets ORDER BY created_at DESC')
    return res.json({ tickets: q.rows })
  } else {
    const q = await pg.query('SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC', [uid])
    return res.json({ tickets: q.rows })
  }
})

router.post('/tickets', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const subject = String(req.body?.subject || '').trim()
  const description = String(req.body?.description || '').trim()
  const priority = String(req.body?.priority || 'medium')
  if (!subject || !description) return res.status(400).json({ error: 'invalid_payload' })
  const ins = await pg.query('INSERT INTO support_tickets (user_id, subject, description, status, priority) VALUES ($1,$2,$3,$4,$5) RETURNING id', [uid, subject, description, 'open', priority])
  const id = ins.rows[0]?.id
  const t = await pg.query('SELECT id, user_id, subject, description, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE id=$1', [id])
  res.status(201).json({ ticket: t.rows[0] })
})

router.get('/tickets/:id', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = req.params.id
  const tr = await pg.query('SELECT * FROM support_tickets WHERE id=$1', [id])
  if (!tr.rows.length) return res.status(404).json({ error: 'not_found' })
  const ticket = tr.rows[0]
  const admin = await isAdmin(uid)
  if (ticket.user_id !== uid && !admin) return res.status(403).json({ error: 'forbidden' })
  const msgs = await pg.query('SELECT id, ticket_id, user_id, message, attachments, created_at FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at ASC', [id])
  res.json({ ticket, messages: msgs.rows })
})

router.post('/tickets/:id/messages', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = req.params.id
  const tr = await pg.query('SELECT user_id FROM support_tickets WHERE id=$1', [id])
  if (!tr.rows.length) return res.status(404).json({ error: 'not_found' })
  const owner = tr.rows[0].user_id
  const admin = await isAdmin(uid)
  if (owner !== uid && !admin) return res.status(403).json({ error: 'forbidden' })
  const message = String(req.body?.message || '').trim()
  const attachments = req.body?.attachments ? JSON.stringify(req.body.attachments) : null
  if (!message) return res.status(400).json({ error: 'invalid_payload' })
  await pg.query('INSERT INTO ticket_messages (ticket_id, user_id, message, attachments) VALUES ($1,$2,$3,$4)', [id, uid, message, attachments])
  const msgs = await pg.query('SELECT id, ticket_id, user_id, message, attachments, created_at FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at ASC', [id])
  res.status(201).json({ messages: msgs.rows })
})

router.put('/tickets/:id/status', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const admin = await isAdmin(uid)
  if (!admin) return res.status(403).json({ error: 'forbidden' })
  const id = req.params.id
  const status = String(req.body?.status || '').trim()
  if (!status) return res.status(400).json({ error: 'invalid_payload' })
  const r = await pg.query('UPDATE support_tickets SET status=$1, updated_at=NOW() WHERE id=$2', [status, id])
  if (Number(r.rowCount || 0) === 0) return res.status(404).json({ error: 'not_found' })
  const t = await pg.query('SELECT id, user_id, subject, description, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE id=$1', [id])
  res.json({ ticket: t.rows[0] })
})

router.put('/tickets/:id/assign', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const admin = await isAdmin(uid)
  if (!admin) return res.status(403).json({ error: 'forbidden' })
  const id = req.params.id
  const assignedTo = String(req.body?.assigned_to || '').trim()
  if (!assignedTo) return res.status(400).json({ error: 'invalid_payload' })
  const userRes = await pg.query('SELECT id, user_type FROM users WHERE id=$1', [assignedTo])
  if (!userRes.rows.length || userRes.rows[0].user_type !== 'admin') return res.status(400).json({ error: 'invalid_assignee' })
  const r = await pg.query('UPDATE support_tickets SET assigned_to=$1, updated_at=NOW() WHERE id=$2', [assignedTo, id])
  if (Number(r.rowCount || 0) === 0) return res.status(404).json({ error: 'not_found' })
  const t = await pg.query('SELECT id, user_id, subject, description, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE id=$1', [id])
  res.json({ ticket: t.rows[0] })
})

export default router