import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

export const rateLimitConfig = {
  client: 100,
  admin: 1000,
  support: 500
}

function makeLimiter(max: number) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max,
    keyGenerator: (req) => {
      const uid = (req as any).userId as string | undefined
      if (uid) return String(uid)
      const ip = req.ip || ''
      return ipKeyGenerator(ip)
    }
  })
}

export const clientLimiter = makeLimiter(rateLimitConfig.client)
export const adminLimiter = makeLimiter(rateLimitConfig.admin)
export const supportLimiter = makeLimiter(rateLimitConfig.support)