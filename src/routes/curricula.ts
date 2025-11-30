import { Router } from 'express'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import Joi from 'joi'
import { validate } from '../middlewares/validate'
import { env } from '../config/env'
import { CV } from '../models/cv'
import { CVVersion } from '../models/cvVersion'
import { randomBytes } from 'crypto'
import { getPDFService } from '../services/pdf'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getEmailService } from '../services/email'
import { User } from '../types/user'
import { getStorageService } from '../services/storage'

const router = Router()

function parsePagination(q: any) {
  const page = Math.max(1, Number(q.page || 1))
  const limit = Math.min(50, Math.max(1, Number(q.limit || 10)))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

const createSchema = Joi.object({
  title: Joi.string().required(),
  template: Joi.string().valid('modern','classic','creative').default('modern'),
  personalInfo: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required()
  }).required()
})

router.get('/', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { page, limit, offset } = parsePagination(req.query)
  const filters: string[] = ['user_id=$1', 'deleted_at IS NULL']
  const args: any[] = [uid]
  if (req.query.template) { filters.push('template=$' + (args.length + 1)); args.push(String(req.query.template)) }
  if (req.query.search) { filters.push('title ILIKE $' + (args.length + 1)); args.push('%' + String(req.query.search) + '%') }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : ''
  const listQuery = `SELECT id, title, template, is_public, download_count, view_count, pdf_url, created_at, updated_at FROM curricula ${where} ORDER BY created_at DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`
  const countQuery = `SELECT COUNT(*) FROM curricula ${where}`
  const { rows } = await pg.query(listQuery, [...args, limit, offset])
  const { rows: countRows } = await pg.query(countQuery, args)
  const total = Number(countRows[0].count)
  return res.json({ items: rows, page, limit, total })
})

router.post('/', requireAuth, validate(createSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING || !env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const shareToken = randomBytes(12).toString('hex')
  const { title, template, personalInfo } = req.body
  const insert = `INSERT INTO curricula (user_id, title, template, is_public, share_token) VALUES ($1,$2,$3,$4,$5) RETURNING id`
  const { rows } = await pg.query(insert, [uid, title, template || 'modern', false, shareToken])
  const curriculaId = rows[0].id as string
  const data = { nome: personalInfo.name, cargo: title, email: personalInfo.email, tel: personalInfo.phone }
  const cvDoc = await CV.create({ userId: uid, curriculaId, ...data })
  await CVVersion.create({ userId: uid, curriculaId, data })
  return res.status(201).json({ id: curriculaId, shareToken })
})

router.get('/:id', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING || !env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT * FROM curricula WHERE id=$1 AND deleted_at IS NULL', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  if (rows[0].user_id !== uid) return res.status(403).json({ error: 'forbidden' })
  const cv = await CV.findOne({ curriculaId: id })
  return res.json({ meta: rows[0], data: cv })
})

const updateSchema = Joi.object({
  title: Joi.string().min(2).optional(),
  template: Joi.string().valid('modern','classic','creative').optional(),
  is_public: Joi.boolean().optional(),
  personalInfo: Joi.object({
    name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional()
  }).optional()
})

router.put('/:id', requireAuth, validate(updateSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING || !env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT user_id FROM curricula WHERE id=$1 AND deleted_at IS NULL', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  if (rows[0].user_id !== uid) return res.status(403).json({ error: 'forbidden' })
  const updates: string[] = []
  const values: any[] = []
  const fields = ['title','template','is_public']
  fields.forEach(f => { if (req.body[f] !== undefined) { updates.push(`${f}=$${updates.length+1}`); values.push(req.body[f]) } })
  if (updates.length) {
    values.push(id)
    const sql = `UPDATE curricula SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`
    await pg.query(sql, values)
  }
  if (req.body.personalInfo) {
    const current = await CV.findOne({ curriculaId: id })
    if (current) await CVVersion.create({ userId: uid, curriculaId: id, data: current.toObject() })
    const patch: any = {}
    if (req.body.personalInfo.name !== undefined) patch.nome = req.body.personalInfo.name
    if (req.body.personalInfo.email !== undefined) patch.email = req.body.personalInfo.email
    if (req.body.personalInfo.phone !== undefined) patch.tel = req.body.personalInfo.phone
    await CV.updateOne({ curriculaId: id }, { $set: patch })
  }
  return res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT user_id FROM curricula WHERE id=$1', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  if (rows[0].user_id !== uid) return res.status(403).json({ error: 'forbidden' })
  await pg.query('UPDATE curricula SET deleted_at=NOW(), is_public=false WHERE id=$1', [id])
  return res.json({ ok: true })
})

router.post('/:id/generate-pdf', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING || !env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const id = String(req.params.id)
  const { rows } = await pg.query('SELECT user_id, pdf_url, title, template FROM curricula WHERE id=$1 AND deleted_at IS NULL', [id])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  if (rows[0].user_id !== uid) return res.status(403).json({ error: 'forbidden' })
  const cv = await CV.findOne({ curriculaId: id })
  if (!cv) return res.status(404).json({ error: 'not_found' })
  const pdf = getPDFService()
  const tpl = rows[0].template || 'modern'
  const buffer = await pdf.generateCurriculum({
    nome: cv.nome,
    cargo: cv.cargo,
    email: cv.email,
    tel: cv.tel,
    cep: cv.cep,
    cidade: cv.cidade,
    resumo: cv.resumo,
    empresa: cv.empresa,
    periodo: cv.periodo,
    atividades: cv.atividades
  }, tpl)
  const storage = getStorageService()
  const key = `curricula/${uid}/${id}.pdf`
  const url = await storage.uploadPDF(buffer, key)
  await pg.query('UPDATE curricula SET pdf_url=$1, download_count=download_count+1 WHERE id=$2', [url, id])
  const svc = getEmailService()
  const userRes = await pg.query('SELECT id, email, name FROM users WHERE id=$1', [uid])
  if (userRes.rows.length) await svc.sendCurriculumGenerated(userRes.rows[0] as User, url)
  return res.json({ url })
})

router.get('/:id/share/:token', async (req, res) => {
  if (!env.PG_CONNECTION_STRING || !env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const id = String(req.params.id)
  const token = String(req.params.token)
  const { rows } = await pg.query('SELECT * FROM curricula WHERE id=$1 AND share_token=$2 AND is_public=true AND deleted_at IS NULL', [id, token])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  const cv = await CV.findOne({ curriculaId: id })
  await pg.query('UPDATE curricula SET view_count=view_count+1 WHERE id=$1', [id])
  return res.json({ meta: rows[0], data: cv })
})

export default router