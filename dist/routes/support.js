"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const router = (0, express_1.Router)();
async function isAdmin(userId) {
    const role = await postgres_1.pg.query('SELECT user_type FROM users WHERE id=$1', [userId]);
    return role.rows[0]?.user_type === 'admin';
}
router.get('/tickets', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const admin = await isAdmin(uid);
    if (admin) {
        const q = await postgres_1.pg.query('SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at FROM support_tickets ORDER BY created_at DESC');
        return res.json({ tickets: q.rows });
    }
    else {
        const q = await postgres_1.pg.query('SELECT id, user_id, subject, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE user_id=$1 ORDER BY created_at DESC', [uid]);
        return res.json({ tickets: q.rows });
    }
});
router.post('/tickets', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const subject = String(req.body?.subject || '').trim();
    const description = String(req.body?.description || '').trim();
    const priority = String(req.body?.priority || 'medium');
    if (!subject || !description)
        return res.status(400).json({ error: 'invalid_payload' });
    const ins = await postgres_1.pg.query('INSERT INTO support_tickets (user_id, subject, description, status, priority) VALUES ($1,$2,$3,$4,$5) RETURNING id', [uid, subject, description, 'open', priority]);
    const id = ins.rows[0]?.id;
    const t = await postgres_1.pg.query('SELECT id, user_id, subject, description, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE id=$1', [id]);
    res.status(201).json({ ticket: t.rows[0] });
});
router.get('/tickets/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = req.params.id;
    const tr = await postgres_1.pg.query('SELECT * FROM support_tickets WHERE id=$1', [id]);
    if (!tr.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const ticket = tr.rows[0];
    const admin = await isAdmin(uid);
    if (ticket.user_id !== uid && !admin)
        return res.status(403).json({ error: 'forbidden' });
    const msgs = await postgres_1.pg.query('SELECT id, ticket_id, user_id, message, attachments, created_at FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at ASC', [id]);
    res.json({ ticket, messages: msgs.rows });
});
router.post('/tickets/:id/messages', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = req.params.id;
    const tr = await postgres_1.pg.query('SELECT user_id FROM support_tickets WHERE id=$1', [id]);
    if (!tr.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const owner = tr.rows[0].user_id;
    const admin = await isAdmin(uid);
    if (owner !== uid && !admin)
        return res.status(403).json({ error: 'forbidden' });
    const message = String(req.body?.message || '').trim();
    const attachments = req.body?.attachments ? JSON.stringify(req.body.attachments) : null;
    if (!message)
        return res.status(400).json({ error: 'invalid_payload' });
    await postgres_1.pg.query('INSERT INTO ticket_messages (ticket_id, user_id, message, attachments) VALUES ($1,$2,$3,$4)', [id, uid, message, attachments]);
    const msgs = await postgres_1.pg.query('SELECT id, ticket_id, user_id, message, attachments, created_at FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at ASC', [id]);
    res.status(201).json({ messages: msgs.rows });
});
router.put('/tickets/:id/status', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const admin = await isAdmin(uid);
    if (!admin)
        return res.status(403).json({ error: 'forbidden' });
    const id = req.params.id;
    const status = String(req.body?.status || '').trim();
    if (!status)
        return res.status(400).json({ error: 'invalid_payload' });
    const r = await postgres_1.pg.query('UPDATE support_tickets SET status=$1, updated_at=NOW() WHERE id=$2', [status, id]);
    if (Number(r.rowCount || 0) === 0)
        return res.status(404).json({ error: 'not_found' });
    const t = await postgres_1.pg.query('SELECT id, user_id, subject, description, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE id=$1', [id]);
    res.json({ ticket: t.rows[0] });
});
router.put('/tickets/:id/assign', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const admin = await isAdmin(uid);
    if (!admin)
        return res.status(403).json({ error: 'forbidden' });
    const id = req.params.id;
    const assignedTo = String(req.body?.assigned_to || '').trim();
    if (!assignedTo)
        return res.status(400).json({ error: 'invalid_payload' });
    const userRes = await postgres_1.pg.query('SELECT id, user_type FROM users WHERE id=$1', [assignedTo]);
    if (!userRes.rows.length || userRes.rows[0].user_type !== 'admin')
        return res.status(400).json({ error: 'invalid_assignee' });
    const r = await postgres_1.pg.query('UPDATE support_tickets SET assigned_to=$1, updated_at=NOW() WHERE id=$2', [assignedTo, id]);
    if (Number(r.rowCount || 0) === 0)
        return res.status(404).json({ error: 'not_found' });
    const t = await postgres_1.pg.query('SELECT id, user_id, subject, description, status, priority, assigned_to, created_at, updated_at FROM support_tickets WHERE id=$1', [id]);
    res.json({ ticket: t.rows[0] });
});
exports.default = router;
