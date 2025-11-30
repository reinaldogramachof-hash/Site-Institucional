"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const adminLog_1 = require("../services/adminLog");
const router = (0, express_1.Router)();
async function isAdmin(userId) {
    const role = await postgres_1.pg.query('SELECT user_type FROM users WHERE id=$1', [userId]);
    return role.rows[0]?.user_type === 'admin';
}
router.get('/users', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    if (!(await isAdmin(uid)))
        return res.status(403).json({ error: 'forbidden' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSizeRaw = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;
    const filters = [];
    const values = [];
    const q = String(req.query.q || '').trim();
    const userType = String(req.query.user_type || '');
    const sub = String(req.query.subscription_status || '');
    const from = String(req.query.created_from || '');
    const to = String(req.query.created_to || '');
    if (q) {
        values.push(`%${q}%`);
        filters.push(`(email ILIKE $${values.length} OR name ILIKE $${values.length})`);
    }
    if (userType) {
        values.push(userType);
        filters.push(`user_type = $${values.length}`);
    }
    if (sub) {
        values.push(sub);
        filters.push(`subscription_status = $${values.length}`);
    }
    if (from) {
        values.push(new Date(from));
        filters.push(`created_at >= $${values.length}`);
    }
    if (to) {
        values.push(new Date(to));
        filters.push(`created_at <= $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const totalRes = await postgres_1.pg.query(`SELECT COUNT(*)::int AS c FROM users ${where}`, values);
    const rowsRes = await postgres_1.pg.query(`SELECT id, email, name, user_type, subscription_status, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
    const total = totalRes.rows[0]?.c || 0;
    const hasMore = offset + rowsRes.rows.length < total;
    res.json({ items: rowsRes.rows, page, pageSize, total, hasMore });
});
router.get('/users/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    if (!(await isAdmin(uid)))
        return res.status(403).json({ error: 'forbidden' });
    const id = req.params.id;
    const r = await postgres_1.pg.query('SELECT * FROM users WHERE id=$1', [id]);
    if (!r.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const user = r.rows[0];
    const curr = await postgres_1.pg.query('SELECT COUNT(*)::int AS c FROM curricula WHERE user_id=$1', [id]);
    const appt = await postgres_1.pg.query('SELECT COUNT(*)::int AS c FROM appointments WHERE user_id=$1', [id]);
    const mei = await postgres_1.pg.query('SELECT COUNT(*)::int AS c FROM mei_services WHERE user_id=$1', [id]);
    const pay = await postgres_1.pg.query('SELECT COUNT(*)::int AS c FROM payments WHERE user_id=$1', [id]);
    res.json({ user, stats: { curricula: curr.rows[0]?.c || 0, appointments: appt.rows[0]?.c || 0, mei_services: mei.rows[0]?.c || 0, payments: pay.rows[0]?.c || 0 } });
});
router.put('/users/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const adminId = req.userId;
    if (!(await isAdmin(adminId)))
        return res.status(403).json({ error: 'forbidden' });
    const id = req.params.id;
    const allowed = ['name', 'email', 'user_type', 'subscription_status'];
    const set = [];
    const values = [];
    for (const k of allowed) {
        if (typeof req.body[k] !== 'undefined') {
            values.push(req.body[k]);
            set.push(`${k}=$${values.length}`);
        }
    }
    if (!set.length)
        return res.status(400).json({ error: 'no_fields' });
    values.push(id);
    const r = await postgres_1.pg.query(`UPDATE users SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`, values);
    if (Number(r.rowCount || 0) === 0)
        return res.status(404).json({ error: 'not_found' });
    await (0, adminLog_1.logAdminAction)(adminId, 'update', 'user', id, { fields: allowed.filter(k => typeof req.body[k] !== 'undefined') }, req);
    const u = await postgres_1.pg.query('SELECT id, email, name, user_type, subscription_status, created_at, updated_at FROM users WHERE id=$1', [id]);
    res.json({ user: u.rows[0] });
});
router.get('/mei-services', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    if (!(await isAdmin(uid)))
        return res.status(403).json({ error: 'forbidden' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSizeRaw = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;
    const filters = [];
    const values = [];
    const status = String(req.query.status || '');
    const cnpj = String(req.query.cnpj || '');
    const name = String(req.query.company_name || '');
    if (status) {
        values.push(status);
        filters.push(`status = $${values.length}`);
    }
    if (cnpj) {
        values.push(cnpj);
        filters.push(`cnpj = $${values.length}`);
    }
    if (name) {
        values.push(`%${name}%`);
        filters.push(`company_name ILIKE $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const totalRes = await postgres_1.pg.query(`SELECT COUNT(*)::int AS c FROM mei_services ${where}`, values);
    const rowsRes = await postgres_1.pg.query(`SELECT id, user_id, cnpj, company_name, status, opened_date, created_at FROM mei_services ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
    const total = totalRes.rows[0]?.c || 0;
    const hasMore = offset + rowsRes.rows.length < total;
    res.json({ items: rowsRes.rows, page, pageSize, total, hasMore });
});
router.get('/appointments', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    if (!(await isAdmin(uid)))
        return res.status(403).json({ error: 'forbidden' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSizeRaw = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;
    const filters = [];
    const values = [];
    const status = String(req.query.status || '');
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (status) {
        values.push(status);
        filters.push(`status = $${values.length}`);
    }
    if (from) {
        values.push(new Date(from));
        filters.push(`scheduled_date >= $${values.length}`);
    }
    if (to) {
        values.push(new Date(to));
        filters.push(`scheduled_date <= $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const totalRes = await postgres_1.pg.query(`SELECT COUNT(*)::int AS c FROM appointments ${where}`, values);
    const rowsRes = await postgres_1.pg.query(`SELECT id, user_id, service_type, scheduled_date, duration, status, created_at FROM appointments ${where} ORDER BY scheduled_date DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
    const total = totalRes.rows[0]?.c || 0;
    const hasMore = offset + rowsRes.rows.length < total;
    res.json({ items: rowsRes.rows, page, pageSize, total, hasMore });
});
router.get('/payments', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    if (!(await isAdmin(uid)))
        return res.status(403).json({ error: 'forbidden' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSizeRaw = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;
    const filters = [];
    const values = [];
    const status = String(req.query.status || '');
    const provider = String(req.query.provider || '');
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (status) {
        values.push(status);
        filters.push(`status = $${values.length}`);
    }
    if (provider) {
        values.push(provider);
        filters.push(`provider = $${values.length}`);
    }
    if (from) {
        values.push(new Date(from));
        filters.push(`created_at >= $${values.length}`);
    }
    if (to) {
        values.push(new Date(to));
        filters.push(`created_at <= $${values.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const totalRes = await postgres_1.pg.query(`SELECT COUNT(*)::int AS c FROM payments ${where}`, values);
    const rowsRes = await postgres_1.pg.query(`SELECT id, user_id, amount, currency, status, provider, created_at FROM payments ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, offset]);
    const total = totalRes.rows[0]?.c || 0;
    const hasMore = offset + rowsRes.rows.length < total;
    res.json({ items: rowsRes.rows, page, pageSize, total, hasMore });
});
router.get('/metrics', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    if (!(await isAdmin(uid)))
        return res.status(403).json({ error: 'forbidden' });
    const totalUsersRes = await postgres_1.pg.query('SELECT COUNT(*)::int AS c FROM users');
    const newUsers24Res = await postgres_1.pg.query("SELECT COUNT(*)::int AS c FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'");
    const activeSubsRes = await postgres_1.pg.query("SELECT COUNT(*)::int AS c FROM users WHERE subscription_status='active'");
    const revenueTodayRes = await postgres_1.pg.query("SELECT COALESCE(SUM(amount),0)::int AS s FROM payments WHERE status IN ('succeeded','approved','paid') AND created_at::date = CURRENT_DATE");
    const revenue7dRes = await postgres_1.pg.query("SELECT COALESCE(SUM(amount),0)::int AS s FROM payments WHERE status IN ('succeeded','approved','paid') AND created_at >= NOW() - INTERVAL '7 days'");
    const pendingApptRes = await postgres_1.pg.query("SELECT COUNT(*)::int AS c FROM appointments WHERE scheduled_date >= NOW() AND status IN ('pending','confirmed')");
    const overdueDasRes = await postgres_1.pg.query("SELECT COUNT(*)::int AS c FROM mei_invoices WHERE status='overdue'");
    res.json({
        total_users: totalUsersRes.rows[0]?.c || 0,
        new_users_24h: newUsers24Res.rows[0]?.c || 0,
        active_subscriptions: activeSubsRes.rows[0]?.c || 0,
        revenue_today_cents: revenueTodayRes.rows[0]?.s || 0,
        revenue_7d_cents: revenue7dRes.rows[0]?.s || 0,
        upcoming_appointments: pendingApptRes.rows[0]?.c || 0,
        overdue_das: overdueDasRes.rows[0]?.c || 0
    });
});
exports.default = router;
