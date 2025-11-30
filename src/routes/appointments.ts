import { Router } from 'express'
import Joi from 'joi'
import { validate } from '../middlewares/validate'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import { env } from '../config/env'

const router = Router()

const createSchema = Joi.object({
  service_type: Joi.string().max(100).required(),
  scheduled_date: Joi.date().required(),
  duration: Joi.number().integer().min(15).max(480).required(),
  status: Joi.string().valid('pending','confirmed','completed','cancelled').optional(),
  notes: Joi.string().optional(),
  location_type: Joi.string().valid('in_person','online').optional(),
  address: Joi.string().optional(),
  online_meeting_url: Joi.string().uri().optional()
})

router.get('/', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const filters: string[] = ['user_id=$1']
  const vals: any[] = [uid]
  if (req.query.from) { filters.push('scheduled_date >= $' + (vals.length + 1)); vals.push(new Date(String(req.query.from))) }
  if (req.query.to) { filters.push('scheduled_date <= $' + (vals.length + 1)); vals.push(new Date(String(req.query.to))) }
  if (req.query.status) { filters.push('status=$' + (vals.length + 1)); vals.push(String(req.query.status)) }
  if (req.query.service_type) { filters.push('service_type=$' + (vals.length + 1)); vals.push(String(req.query.service_type)) }
  const sql = `SELECT * FROM appointments WHERE ${filters.join(' AND ')} ORDER BY scheduled_date DESC`
  const { rows } = await pg.query(sql, vals)
  return res.json({ items: rows })
})

router.post('/', requireAuth, validate(createSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { service_type, scheduled_date, duration, status, notes, location_type, address, online_meeting_url } = req.body
  const start = new Date(scheduled_date)
  const end = new Date(start.getTime() + Number(duration) * 60000)
  const conflictSql = `
    SELECT id FROM appointments
    WHERE user_id=$1 AND status IN ('pending','confirmed')
      AND scheduled_date < $3
      AND (scheduled_date + (duration || ' minutes')::interval) > $2
    LIMIT 1`
  const conflict = await pg.query(conflictSql, [uid, start, end])
  if (conflict.rows.length) return res.status(409).json({ error: 'conflict' })
  const sql = 'INSERT INTO appointments (user_id, service_type, scheduled_date, duration, status, notes, location_type, address, online_meeting_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id'
  const { rows } = await pg.query(sql, [uid, service_type, start, duration, status || 'pending', notes || null, location_type || 'in_person', address || null, online_meeting_url || null])
  return res.status(201).json({ id: rows[0].id })
})

const updateSchema = Joi.object({
  service_type: Joi.string().max(100).optional(),
  scheduled_date: Joi.date().optional(),
  duration: Joi.number().integer().min(15).max(480).optional(),
  status: Joi.string().valid('pending','confirmed','completed','cancelled').optional(),
  notes: Joi.string().optional(),
  location_type: Joi.string().valid('in_person','online').optional(),
  address: Joi.string().optional(),
  online_meeting_url: Joi.string().uri().optional(),
  reminder_sent: Joi.boolean().optional()
})

router.patch('/:id', requireAuth, validate(updateSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT user_id FROM appointments WHERE id=$1', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  if (rows[0].user_id !== uid) return res.status(403).json({ error: 'forbidden' })
  const set: string[] = []
  const vals: any[] = []
  Object.keys(req.body).forEach(k => { if (updateSchema.extract(k)) { set.push(`${k}=$${set.length+1}`); vals.push(req.body[k]) } })
  if (!set.length) return res.json({ ok: true })
  vals.push(id)
  const sql = `UPDATE appointments SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`
  await pg.query(sql, vals)
  return res.json({ ok: true })
})

router.get('/:id', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT * FROM appointments WHERE id=$1', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  if (rows[0].user_id !== uid) {
    const ures = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
    if (!ures.rows.length || ures.rows[0].user_type !== 'admin') return res.status(403).json({ error: 'forbidden' })
  }
  return res.json(rows[0])
})

router.put('/:id', requireAuth, validate(updateSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT user_id FROM appointments WHERE id=$1', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  let allowed = rows[0].user_id === uid
  if (!allowed) {
    const ures = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
    allowed = !!(ures.rows.length && ures.rows[0].user_type === 'admin')
  }
  if (!allowed) return res.status(403).json({ error: 'forbidden' })
  const set: string[] = []
  const vals: any[] = []
  Object.keys(req.body).forEach(k => { if (updateSchema.extract(k)) { set.push(`${k}=$${set.length+1}`); vals.push(req.body[k]) } })
  if (!set.length) return res.json({ ok: true })
  vals.push(id)
  const sql = `UPDATE appointments SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`
  await pg.query(sql, vals)
  return res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT user_id FROM appointments WHERE id=$1', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  let allowed = rows[0].user_id === uid
  if (!allowed) {
    const ures = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
    allowed = !!(ures.rows.length && ures.rows[0].user_type === 'admin')
  }
  if (!allowed) return res.status(403).json({ error: 'forbidden' })
  await pg.query("UPDATE appointments SET status='cancelled', updated_at=NOW() WHERE id=$1", [id])
  return res.json({ ok: true })
})

router.get('/available-slots', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const day = String(req.query.day)
  const duration = Number(req.query.duration || 60)
  if (!day) return res.status(400).json({ error: 'validation', details: [{ message: 'day required' }] })
  const base = new Date(day + 'T00:00:00')
  const open = new Date(base); open.setHours(9, 0, 0, 0)
  const close = new Date(base); close.setHours(18, 0, 0, 0)
  const q = await pg.query('SELECT scheduled_date, duration FROM appointments WHERE user_id=$1 AND scheduled_date::date=$2 AND status IN (\'pending\',\'confirmed\')', [uid, day])
  const busy: { start: Date; end: Date }[] = q.rows.map(r => ({ start: new Date(r.scheduled_date), end: new Date(new Date(r.scheduled_date).getTime() + Number(r.duration) * 60000) }))
  const slots: string[] = []
  const step = 30
  for (let t = open.getTime(); t + duration * 60000 <= close.getTime(); t += step * 60000) {
    const s = new Date(t)
    const e = new Date(t + duration * 60000)
    const conflict = busy.some(b => s < b.end && e > b.start)
    if (!conflict) slots.push(s.toISOString())
  }
  return res.json({ day, duration, slots })
})

export default router