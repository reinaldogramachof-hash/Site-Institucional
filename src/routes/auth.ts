import { Router } from 'express'
import { pg } from '../config/postgres'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Joi from 'joi'
import { validate } from '../middlewares/validate'
import { env } from '../config/env'
import { requireAuth } from '../middlewares/auth'
import { randomBytes } from 'crypto'
import { getEmailService } from '../services/email'
import { User } from '../types/user'
import https from 'https'

const router = Router()

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required(),
  phone: Joi.string().pattern(/^\d{10,11}$/).optional(),
  cpf: Joi.string().pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/).optional(),
  cnpj: Joi.string().optional()
})

function strongPassword(p: string) {
  const hasUpper = /[A-Z]/.test(p)
  const hasLower = /[a-z]/.test(p)
  const hasNum = /[0-9]/.test(p)
  const hasSpec = /[^A-Za-z0-9]/.test(p)
  return p.length >= 8 && hasUpper && hasLower && hasNum && hasSpec
}

function issueAccessToken(uid: string) {
  return jwt.sign({ uid }, env.JWT_SECRET, { expiresIn: '15m' })
}

async function issueRefreshToken(uid: string) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await pg.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)', [uid, token, expires])
  return token
}

router.post('/register', validate(registerSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { email, password, name, phone, cpf, cnpj } = req.body
  if (!strongPassword(password)) return res.status(400).json({ error: 'weak_password' })
  const { rows: existing } = await pg.query('SELECT id, email_verified FROM users WHERE email=$1', [email])
  if (existing.length) {
    if (existing[0].email_verified) {
      return res.status(409).json({ error: 'email_taken' })
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const verificationToken = randomBytes(24).toString('hex')
  const verificationExpires = new Date(Date.now() + 60 * 60 * 1000)

  const insert = `
    INSERT INTO users (email, password_hash, name, phone, cpf, cnpj, email_verification_token, email_verification_expires, type) 
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) 
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = $2, name = $3, phone = $4, cpf = $5, cnpj = $6, 
        email_verification_token = $7, email_verification_expires = $8, type = $9, updated_at = NOW()
    RETURNING id, email, name`
  
  const { rows } = await pg.query(insert, [email, passwordHash, name, phone || null, cpf || null, cnpj || null, verificationToken, verificationExpires, 'customer'])
  
  const svc = getEmailService()
  await svc.sendVerificationEmail({ id: rows[0].id, email, name } as User, verificationToken)

  return res.status(200).json({ message: 'registration_successful' })
})

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
})

router.post('/login', validate(loginSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { email, password } = req.body
  const { rows } = await pg.query('SELECT id, password_hash, email_verified FROM users WHERE email=$1', [email])
  if (!rows.length) return res.status(401).json({ error: 'invalid_credentials' })
  const user = rows[0]
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
  if (!user.email_verified) return res.status(401).json({ error: 'email_not_verified' })
  const accessToken = issueAccessToken(user.id)
  const refreshToken = await issueRefreshToken(user.id)
  await pg.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id])
  return res.json({ accessToken, refreshToken })
})

router.post('/refresh-token', async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { refreshToken } = req.body || {}
  if (!refreshToken) return res.status(400).json({ error: 'missing_token' })
  const { rows } = await pg.query('SELECT user_id, expires_at FROM refresh_tokens WHERE token=$1', [refreshToken])
  if (!rows.length) return res.status(401).json({ error: 'invalid_token' })
  if (new Date(rows[0].expires_at).getTime() < Date.now()) return res.status(401).json({ error: 'expired_token' })
  const uid = rows[0].user_id as string
  await pg.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken])
  const newRefresh = await issueRefreshToken(uid)
  const accessToken = issueAccessToken(uid)
  return res.json({ accessToken, refreshToken: newRefresh })
})

const forgotSchema = Joi.object({ email: Joi.string().email().required() })
router.post('/forgot-password', validate(forgotSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { email } = req.body
  const { rows } = await pg.query('SELECT id FROM users WHERE email=$1', [email])
  if (!rows.length) return res.status(200).json({ ok: true })
  const uid = rows[0].id as string
  const token = randomBytes(24).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000)
  await pg.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)', [uid, token, expires])
  const svc = getEmailService()
  await svc.sendPasswordReset(email, token)
  return res.status(200).json({ ok: true })
})

const resetSchema = Joi.object({ token: Joi.string().required(), password: Joi.string().min(8).required() })
router.post('/reset-password', validate(resetSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { token, password } = req.body
  if (!strongPassword(password)) return res.status(400).json({ error: 'weak_password' })
  const { rows } = await pg.query('SELECT user_id, expires_at FROM password_resets WHERE token=$1', [token])
  if (!rows.length) return res.status(400).json({ error: 'invalid_token' })
  if (new Date(rows[0].expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'expired_token' })
  const uid = rows[0].user_id as string
  const passwordHash = await bcrypt.hash(password, 10)
  await pg.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, uid])
  await pg.query('DELETE FROM password_resets WHERE user_id=$1', [uid])
  return res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const { rows } = await pg.query('SELECT id, email, name, user_type, phone, subscription_plan, subscription_status, created_at, updated_at, last_login FROM users WHERE id=$1', [uid])
  if (!rows.length) return res.status(404).json({ error: 'not_found' })
  return res.json(rows[0])
})

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
})

router.get('/verify-email', validate(verifyEmailSchema, 'query'), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { token } = req.query

  const { rows } = await pg.query(
    'SELECT id, email_verification_expires FROM users WHERE email_verification_token=$1',
    [token]
  )

  if (!rows.length) return res.status(400).json({ error: 'invalid_token' })

  const user = rows[0]

  if (new Date(user.email_verification_expires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'expired_token' })
  }

  await pg.query(
    'UPDATE users SET email_verified=true, email_verification_token=null, email_verification_expires=null, updated_at=NOW() WHERE id=$1',
    [user.id]
  )

  const accessToken = issueAccessToken(user.id)
  const refreshToken = await issueRefreshToken(user.id)

  return res.json({ accessToken, refreshToken })
})

router.post('/firebase-login', async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { idToken } = req.body || {}
  if (!idToken || typeof idToken !== 'string') return res.status(400).json({ error: 'missing_token' })
  if (!env.FIREBASE_PROJECT_ID) return res.status(500).json({ error: 'firebase_not_configured' })
  try {
    const decoded: any = (jwt.decode(idToken, { complete: true }) as any)
    const kid = decoded?.header?.kid
    if (!kid) return res.status(401).json({ error: 'invalid_token' })
    function getJSON(url: string): Promise<any> {
      return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
          if (resp.statusCode && resp.statusCode >= 400) {
            reject(new Error('status_' + resp.statusCode))
            return
          }
          let data = ''
          resp.on('data', (chunk) => { data += chunk })
          resp.on('end', () => {
            try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
          })
        }).on('error', reject)
      })
    }
    let certs: Record<string,string>
    try {
      certs = await getJSON('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')
    } catch {
      return res.status(502).json({ error: 'certs_fetch_failed' })
    }
    const cert = certs[kid]
    if (!cert) return res.status(401).json({ error: 'invalid_token' })
    const verified: any = jwt.verify(idToken, cert, {
      algorithms: ['RS256'],
      audience: env.FIREBASE_PROJECT_ID,
      issuer: 'https://securetoken.google.com/' + env.FIREBASE_PROJECT_ID
    })
    const email = String(verified.email || '')
    const name = String(verified.name || '')
    const uidProvider = String(verified.user_id || verified.sub || '')
    if (!email) return res.status(400).json({ error: 'email_required' })
    let userId: string | null = null
    const existing = await pg.query('SELECT id FROM users WHERE email=$1', [email])
    if (existing.rows.length) {
      userId = existing.rows[0].id
    } else {
      const insert = `INSERT INTO users (email, name, email_verified, type) VALUES ($1,$2,$3,$4) RETURNING id`
      const ins = await pg.query(insert, [email, name || null, true, 'customer'])
      userId = ins.rows[0].id
    }
    const accessToken = issueAccessToken(userId!)
    const refreshToken = await issueRefreshToken(userId!)
    await pg.query('UPDATE users SET last_login=NOW(), provider_uid=$2 WHERE id=$1', [userId, uidProvider || null])
    return res.json({ accessToken, refreshToken })
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token' })
  }
})

const bootstrapAdminSchema = Joi.object({
  secret: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required()
})

router.post('/bootstrap-admin', validate(bootstrapAdminSchema), async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const { secret, email, password, name } = req.body
  if (!env.BACKUP_SECRET || secret !== env.BACKUP_SECRET) return res.status(403).json({ error: 'forbidden' })
  const existing = await pg.query('SELECT id, user_type FROM users WHERE email=$1', [email])
  let id: string
  const password_hash = await bcrypt.hash(password, 10)
  if (existing.rows.length) {
    id = existing.rows[0].id
    await pg.query("UPDATE users SET password_hash=$1, name=$2, email_verified=true, user_type='admin', updated_at=NOW() WHERE id=$3", [password_hash, name, id])
  } else {
    const ins = await pg.query("INSERT INTO users (email, password_hash, name, email_verified, user_type) VALUES ($1,$2,$3,$4,$5) RETURNING id", [email, password_hash, name, true, 'admin'])
    id = ins.rows[0].id
  }
  await pg.query('UPDATE users SET last_login=NOW() WHERE id=$1', [id])
  const accessToken = issueAccessToken(id)
  const refreshToken = await issueRefreshToken(id)
  return res.json({ id, email, name, accessToken, refreshToken })
})

export default router
