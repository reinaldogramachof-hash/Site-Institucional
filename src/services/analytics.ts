import { pg } from '../config/postgres'
import { env } from '../config/env'

export type GrowthPoint = { date: string; count: number }
export type GrowthData = { points: GrowthPoint[]; total: number }
export type RevenuePoint = { period: string; amount_cents: number }
export type RevenueData = { total_cents: number; count: number; by_period: RevenuePoint[] }
export type UsagePoint = { period: string; count: number }
export type UsageData = { service_type: string; total: number; by_period: UsagePoint[] }

export interface AnalyticsService {
  getUserGrowth(startDate: Date, endDate: Date): Promise<GrowthData>
  getRevenueMetrics(period: string): Promise<RevenueData>
  getServiceUsage(serviceType: string, period: string): Promise<UsageData>
  getChurnRate(period: string): Promise<number>
}

function periodToRange(period: string): { start: Date; end: Date; group: 'day' | 'month' } {
  const now = new Date()
  const p = String(period).toLowerCase()
  if (p === 'today') return { start: new Date(now.toDateString()), end: now, group: 'day' }
  if (p === '7d') return { start: new Date(now.getTime() - 7 * 24 * 3600 * 1000), end: now, group: 'day' }
  if (p === '30d') return { start: new Date(now.getTime() - 30 * 24 * 3600 * 1000), end: now, group: 'day' }
  if (p === '90d') return { start: new Date(now.getTime() - 90 * 24 * 3600 * 1000), end: now, group: 'day' }
  if (p === '12m') return { start: new Date(now.getFullYear() - 1, now.getMonth(), 1), end: now, group: 'month' }
  return { start: new Date(now.getTime() - 30 * 24 * 3600 * 1000), end: now, group: 'day' }
}

class DefaultAnalyticsService implements AnalyticsService {
  async getUserGrowth(startDate: Date, endDate: Date): Promise<GrowthData> {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const q = await pg.query("SELECT date_trunc('day', created_at) AS d, COUNT(*)::int AS c FROM users WHERE created_at >= $1 AND created_at <= $2 GROUP BY 1 ORDER BY 1 ASC", [startDate, endDate])
    const points: GrowthPoint[] = q.rows.map(r => ({ date: new Date(r.d as any).toISOString().slice(0, 10), count: r.c as number }))
    const total = points.reduce((a, p) => a + p.count, 0)
    return { points, total }
  }
  async getRevenueMetrics(period: string): Promise<RevenueData> {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const { start, end, group } = periodToRange(period)
    const totalRes = await pg.query("SELECT COALESCE(SUM(amount),0)::int AS s, COUNT(*)::int AS c FROM payments WHERE status IN ('succeeded','approved','paid') AND created_at >= $1 AND created_at <= $2", [start, end])
    const groupExpr = group === 'month' ? "to_char(date_trunc('month', created_at),'YYYY-MM')" : "to_char(date_trunc('day', created_at),'YYYY-MM-DD')"
    const byRes = await pg.query(`SELECT ${groupExpr} AS p, COALESCE(SUM(amount),0)::int AS s FROM payments WHERE status IN ('succeeded','approved','paid') AND created_at >= $1 AND created_at <= $2 GROUP BY 1 ORDER BY 1 ASC`, [start, end])
    const by_period: RevenuePoint[] = byRes.rows.map(r => ({ period: String(r.p), amount_cents: Number(r.s) }))
    return { total_cents: Number(totalRes.rows[0]?.s || 0), count: Number(totalRes.rows[0]?.c || 0), by_period }
  }
  async getServiceUsage(serviceType: string, period: string): Promise<UsageData> {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const t = String(serviceType).toLowerCase()
    const { start, end, group } = periodToRange(period)
    const map: Record<string, { table: string; dateField: string }> = {
      appointments: { table: 'appointments', dateField: 'created_at' },
      mei_services: { table: 'mei_services', dateField: 'created_at' },
      curricula: { table: 'curricula', dateField: 'created_at' }
    }
    const cfg = map[t]
    if (!cfg) return { service_type: t, total: 0, by_period: [] }
    const groupExpr = group === 'month' ? `to_char(date_trunc('month', ${cfg.dateField}),'YYYY-MM')` : `to_char(date_trunc('day', ${cfg.dateField}),'YYYY-MM-DD')`
    const totalRes = await pg.query(`SELECT COUNT(*)::int AS c FROM ${cfg.table} WHERE ${cfg.dateField} >= $1 AND ${cfg.dateField} <= $2`, [start, end])
    const rowsRes = await pg.query(`SELECT ${groupExpr} AS p, COUNT(*)::int AS c FROM ${cfg.table} WHERE ${cfg.dateField} >= $1 AND ${cfg.dateField} <= $2 GROUP BY 1 ORDER BY 1 ASC`, [start, end])
    const by_period: UsagePoint[] = rowsRes.rows.map(r => ({ period: String(r.p), count: Number(r.c) }))
    return { service_type: t, total: Number(totalRes.rows[0]?.c || 0), by_period }
  }
  async getChurnRate(period: string): Promise<number> {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const { start, end } = periodToRange(period)
    const r = await pg.query("SELECT SUM(CASE WHEN subscription_status='canceled' THEN 1 ELSE 0 END)::int AS canceled, SUM(CASE WHEN subscription_status='active' THEN 1 ELSE 0 END)::int AS active FROM users WHERE updated_at >= $1 AND updated_at <= $2", [start, end])
    const canceled = Number(r.rows[0]?.canceled || 0)
    const active = Number(r.rows[0]?.active || 0)
    return active + canceled > 0 ? Number((canceled / (active + canceled)).toFixed(4)) : 0
  }
}

export function getAnalyticsService(): AnalyticsService { return new DefaultAnalyticsService() }