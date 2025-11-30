"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsService = getAnalyticsService;
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
function periodToRange(period) {
    const now = new Date();
    const p = String(period).toLowerCase();
    if (p === 'today')
        return { start: new Date(now.toDateString()), end: now, group: 'day' };
    if (p === '7d')
        return { start: new Date(now.getTime() - 7 * 24 * 3600 * 1000), end: now, group: 'day' };
    if (p === '30d')
        return { start: new Date(now.getTime() - 30 * 24 * 3600 * 1000), end: now, group: 'day' };
    if (p === '90d')
        return { start: new Date(now.getTime() - 90 * 24 * 3600 * 1000), end: now, group: 'day' };
    if (p === '12m')
        return { start: new Date(now.getFullYear() - 1, now.getMonth(), 1), end: now, group: 'month' };
    return { start: new Date(now.getTime() - 30 * 24 * 3600 * 1000), end: now, group: 'day' };
}
class DefaultAnalyticsService {
    async getUserGrowth(startDate, endDate) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const q = await postgres_1.pg.query("SELECT date_trunc('day', created_at) AS d, COUNT(*)::int AS c FROM users WHERE created_at >= $1 AND created_at <= $2 GROUP BY 1 ORDER BY 1 ASC", [startDate, endDate]);
        const points = q.rows.map(r => ({ date: new Date(r.d).toISOString().slice(0, 10), count: r.c }));
        const total = points.reduce((a, p) => a + p.count, 0);
        return { points, total };
    }
    async getRevenueMetrics(period) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const { start, end, group } = periodToRange(period);
        const totalRes = await postgres_1.pg.query("SELECT COALESCE(SUM(amount),0)::int AS s, COUNT(*)::int AS c FROM payments WHERE status IN ('succeeded','approved','paid') AND created_at >= $1 AND created_at <= $2", [start, end]);
        const groupExpr = group === 'month' ? "to_char(date_trunc('month', created_at),'YYYY-MM')" : "to_char(date_trunc('day', created_at),'YYYY-MM-DD')";
        const byRes = await postgres_1.pg.query(`SELECT ${groupExpr} AS p, COALESCE(SUM(amount),0)::int AS s FROM payments WHERE status IN ('succeeded','approved','paid') AND created_at >= $1 AND created_at <= $2 GROUP BY 1 ORDER BY 1 ASC`, [start, end]);
        const by_period = byRes.rows.map(r => ({ period: String(r.p), amount_cents: Number(r.s) }));
        return { total_cents: Number(totalRes.rows[0]?.s || 0), count: Number(totalRes.rows[0]?.c || 0), by_period };
    }
    async getServiceUsage(serviceType, period) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const t = String(serviceType).toLowerCase();
        const { start, end, group } = periodToRange(period);
        const map = {
            appointments: { table: 'appointments', dateField: 'created_at' },
            mei_services: { table: 'mei_services', dateField: 'created_at' },
            curricula: { table: 'curricula', dateField: 'created_at' }
        };
        const cfg = map[t];
        if (!cfg)
            return { service_type: t, total: 0, by_period: [] };
        const groupExpr = group === 'month' ? `to_char(date_trunc('month', ${cfg.dateField}),'YYYY-MM')` : `to_char(date_trunc('day', ${cfg.dateField}),'YYYY-MM-DD')`;
        const totalRes = await postgres_1.pg.query(`SELECT COUNT(*)::int AS c FROM ${cfg.table} WHERE ${cfg.dateField} >= $1 AND ${cfg.dateField} <= $2`, [start, end]);
        const rowsRes = await postgres_1.pg.query(`SELECT ${groupExpr} AS p, COUNT(*)::int AS c FROM ${cfg.table} WHERE ${cfg.dateField} >= $1 AND ${cfg.dateField} <= $2 GROUP BY 1 ORDER BY 1 ASC`, [start, end]);
        const by_period = rowsRes.rows.map(r => ({ period: String(r.p), count: Number(r.c) }));
        return { service_type: t, total: Number(totalRes.rows[0]?.c || 0), by_period };
    }
    async getChurnRate(period) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const { start, end } = periodToRange(period);
        const r = await postgres_1.pg.query("SELECT SUM(CASE WHEN subscription_status='canceled' THEN 1 ELSE 0 END)::int AS canceled, SUM(CASE WHEN subscription_status='active' THEN 1 ELSE 0 END)::int AS active FROM users WHERE updated_at >= $1 AND updated_at <= $2", [start, end]);
        const canceled = Number(r.rows[0]?.canceled || 0);
        const active = Number(r.rows[0]?.active || 0);
        return active + canceled > 0 ? Number((canceled / (active + canceled)).toFixed(4)) : 0;
    }
}
function getAnalyticsService() { return new DefaultAnalyticsService(); }
