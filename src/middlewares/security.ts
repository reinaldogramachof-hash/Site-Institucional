import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AccessLog } from '../models/accessLog'
import { pg } from '../config/postgres'
import Redis from 'ioredis'

const memory = new Map<string, { count: number; resetAt: number }>()
const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : undefined

async function rateLimit(uid: string): Promise<boolean> {
  const key = `rl:${uid}`
  const limit = 60
  const windowSec = 60
  if (redis) {
    const tx = redis.multi()
    tx.incr(key)
    tx.expire(key, windowSec)
    const res = await tx.exec()
    const cnt = Number(res?.[0]?.[1] || 0)
    return cnt <= limit
  }
  const now = Date.now()
  const v = memory.get(key)
  if (!v || v.resetAt < now) { memory.set(key, { count: 1, resetAt: now + windowSec * 1000 }); return true }
  v.count += 1
  return v.count <= limit
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ error: 'unauthorized' })
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'unauthorized' })
  try {
    const payload = jwt.verify(parts[1], env.JWT_SECRET) as { uid: string }
    ;(req as any).userId = payload.uid
  } catch { return res.status(401).json({ error: 'unauthorized' }) }
  AccessLog.create({ userId: (req as any).userId, method: req.method, path: req.path, ip: req.ip }).catch(() => {})
  rateLimit((req as any).userId).then(ok => { if (!ok) return res.status(429).json({ error: 'rate_limited' }); next() }).catch(() => res.status(500).json({ error: 'rate_limit_error' }))
}

export function authorize(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const uid = (req as any).userId as string
    if (!uid) return res.status(401).json({ error: 'unauthorized' })
    if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
    const { rows } = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    const role = rows[0].user_type as string
    if (!allowedRoles.includes(role)) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}