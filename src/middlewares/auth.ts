import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ error: 'unauthorized' })
  const [, token] = header.split(' ')
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { uid: string }
    ;(req as any).userId = payload.uid
    next()
  } catch {
    return res.status(401).json({ error: 'unauthorized' })
  }
}