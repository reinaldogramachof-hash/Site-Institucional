"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const events_1 = require("../services/events");
const router = (0, express_1.Router)();
router.get('/', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSizeRaw = Number(req.query.pageSize) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;
    const totalRes = await postgres_1.pg.query('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1', [uid]);
    const rowsRes = await postgres_1.pg.query('SELECT id, title, message, type, related_service, related_id, is_read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [uid, pageSize, offset]);
    const total = totalRes.rows[0]?.c || 0;
    const hasMore = offset + rowsRes.rows.length < total;
    res.json({ items: rowsRes.rows, page, pageSize, total, hasMore });
});
router.put('/:id/read', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = req.params.id;
    const q = await postgres_1.pg.query('UPDATE notifications SET is_read=true, updated_at=NOW() WHERE id=$1 AND user_id=$2 AND is_read=false', [id, uid]);
    res.json({ updated: Number(q.rowCount || 0) > 0 });
});
router.put('/read-all', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const q = await postgres_1.pg.query('UPDATE notifications SET is_read=true, updated_at=NOW() WHERE user_id=$1 AND is_read=false', [uid]);
    res.json({ updated_count: q.rowCount });
});
router.get('/unread-count', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const q = await postgres_1.pg.query('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1 AND is_read=false', [uid]);
    res.json({ count: q.rows[0]?.c || 0 });
});
exports.default = router;
// SSE stream de notificações
router.get('/stream', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (data) => { res.write(`data: ${JSON.stringify(data)}\n\n`); };
    const handler = (payload) => send({ type: 'notification', payload });
    events_1.notificationEvents.on(`user:${uid}`, handler);
    req.on('close', () => { events_1.notificationEvents.off(`user:${uid}`, handler); });
});
