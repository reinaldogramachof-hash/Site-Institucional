import { Router } from 'express'
import { env } from '../config/env'
import { pg } from '../config/postgres'
import { getStorageService } from '../services/storage'
import os from 'os'
import { monitorEventLoopDelay } from 'perf_hooks'

const router = Router()
const eld = monitorEventLoopDelay({ resolution: 20 })
eld.enable()

router.get('/', async (req, res) => {
  const start = Date.now()
  let db: { ok: boolean; error?: string } = { ok: false }
  let redis: { ok: boolean; error?: string } = { ok: false }
  let s3: { ok: boolean; error?: string } = { ok: false }
  try {
    if (env.PG_CONNECTION_STRING) {
      await pg.query('SELECT 1')
      db.ok = true
    } else db = { ok: false, error: 'db_unconfigured' }
  } catch (e: any) { db = { ok: false, error: String(e?.message || e) } }
  try {
    if (env.REDIS_URL) {
      const Redis = (await import('ioredis')).default
      const r = new Redis(env.REDIS_URL)
      const pong = await r.ping()
      await r.quit()
      redis.ok = pong?.toLowerCase?.() === 'pong'
    } else redis = { ok: false, error: 'redis_unconfigured' }
  } catch (e: any) { redis = { ok: false, error: String(e?.message || e) } }
  try {
    const storage = getStorageService()
    const key = `health/${Date.now()}_${Math.random().toString(16).slice(2)}.txt`
    const url = await storage.uploadFile(Buffer.from('ok'), key, 'text/plain')
    await storage.deleteFile(url)
    s3.ok = true
  } catch (e: any) { s3 = { ok: false, error: String(e?.message || e) } }
  const mem = process.memoryUsage()
  const cpu = process.cpuUsage()
  const uptime = process.uptime()
  const perf = {
    uptime_seconds: Number(uptime.toFixed(0)),
    memory_rss_mb: Number((mem.rss / 1024 / 1024).toFixed(1)),
    memory_heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
    cpu_user_ms: Math.round(cpu.user / 1000),
    cpu_system_ms: Math.round(cpu.system / 1000),
    event_loop_delay_mean_ms: Number((eld.mean / 1e6).toFixed(2)),
    event_loop_delay_max_ms: Number((eld.max / 1e6).toFixed(2)),
    response_time_ms: Date.now() - start,
    loadavg: os.loadavg()
  }
  res.json({ services: { db, redis, storage: s3 }, perf })
})

export default router