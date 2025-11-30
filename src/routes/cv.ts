import { Router } from 'express'
import Joi from 'joi'
import { validate } from '../middlewares/validate'
import { requireAuth } from '../middlewares/auth'
import { CV } from '../models/cv'

const router = Router()

const cvSchema = Joi.object({
  nome: Joi.string().required(),
  cargo: Joi.string().required(),
  email: Joi.string().email().required(),
  tel: Joi.string().required(),
  cep: Joi.string().optional(),
  cidade: Joi.string().optional(),
  resumo: Joi.string().optional(),
  empresa: Joi.string().optional(),
  periodo: Joi.string().optional(),
  atividades: Joi.string().optional()
})

router.post('/', requireAuth, validate(cvSchema), async (req, res) => {
  if (!process.env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const userId = (req as any).userId as string
  const doc = await CV.create({ userId, ...req.body })
  return res.status(201).json({ id: String((doc as any)._id) })
})

router.get('/', requireAuth, async (req, res) => {
  if (!process.env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const userId = (req as any).userId as string
  const list = await CV.find({ userId }).sort({ createdAt: -1 })
  return res.json({ items: list })
})

const cvUpdateSchema = Joi.object({
  nome: Joi.string().optional(),
  cargo: Joi.string().optional(),
  email: Joi.string().email().optional(),
  tel: Joi.string().optional(),
  cep: Joi.string().optional(),
  cidade: Joi.string().optional(),
  resumo: Joi.string().optional(),
  empresa: Joi.string().optional(),
  periodo: Joi.string().optional(),
  atividades: Joi.string().optional()
})

router.put('/by-curricula/:curriculaId', requireAuth, validate(cvUpdateSchema), async (req, res) => {
  if (!process.env.MONGO_URI) return res.status(503).json({ error: 'db_unavailable' })
  const userId = (req as any).userId as string
  const curriculaId = String(req.params.curriculaId)
  const existing = await CV.findOne({ userId, curriculaId })
  if (!existing) return res.status(404).json({ error: 'not_found' })
  await CV.updateOne({ userId, curriculaId }, { $set: req.body })
  return res.json({ ok: true })
})

export default router
