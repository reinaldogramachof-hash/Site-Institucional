"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const storage_1 = require("../services/storage");
const reports_1 = require("../jobs/reports");
const router = (0, express_1.Router)();
function toTitle(t) {
    const map = { financeiro: 'Relatório Financeiro', usuarios: 'Relatório de Usuários', servicos: 'Relatório de Serviços' };
    return map[t] || t;
}
router.get('/', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const q = await postgres_1.pg.query('SELECT id, title, description, report_type, status, created_at, completed_at, file_url FROM reports WHERE generated_by=$1 ORDER BY created_at DESC', [uid]);
    res.json({ reports: q.rows });
});
router.post('/generate', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const type = String((req.body?.report_type || '').toLowerCase());
    if (!['financeiro', 'usuarios', 'servicos'].includes(type))
        return res.status(400).json({ error: 'invalid_type' });
    const params = req.body?.parameters || null;
    const title = toTitle(type);
    const ins = await postgres_1.pg.query('INSERT INTO reports (title, description, report_type, parameters, generated_by, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id', [title, '', type, params ? JSON.stringify(params) : null, uid, 'pending']);
    const id = ins.rows[0]?.id;
    setImmediate(() => { (0, reports_1.generateReportJob)(id).catch(() => { }); });
    res.status(202).json({ id, status: 'pending' });
});
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = req.params.id;
    const r = await postgres_1.pg.query('SELECT * FROM reports WHERE id=$1', [id]);
    if (!r.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const row = r.rows[0];
    const role = await postgres_1.pg.query('SELECT user_type FROM users WHERE id=$1', [uid]);
    const isAdmin = role.rows[0]?.user_type === 'admin';
    if (row.generated_by !== uid && !isAdmin)
        return res.status(403).json({ error: 'forbidden' });
    res.json(row);
});
router.get('/:id/download', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = req.params.id;
    const r = await postgres_1.pg.query('SELECT file_url, generated_by FROM reports WHERE id=$1', [id]);
    if (!r.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const row = r.rows[0];
    const role = await postgres_1.pg.query('SELECT user_type FROM users WHERE id=$1', [uid]);
    const isAdmin = role.rows[0]?.user_type === 'admin';
    if (row.generated_by !== uid && !isAdmin)
        return res.status(403).json({ error: 'forbidden' });
    if (!row.file_url)
        return res.status(409).json({ error: 'not_ready' });
    const storage = (0, storage_1.getStorageService)();
    const url = await storage.getSignedUrl(row.file_url);
    res.json({ url });
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = req.params.id;
    const r = await postgres_1.pg.query('SELECT file_url, generated_by FROM reports WHERE id=$1', [id]);
    if (!r.rows.length)
        return res.status(404).json({ error: 'not_found' });
    const row = r.rows[0];
    const role = await postgres_1.pg.query('SELECT user_type FROM users WHERE id=$1', [uid]);
    const isAdmin = role.rows[0]?.user_type === 'admin';
    if (row.generated_by !== uid && !isAdmin)
        return res.status(403).json({ error: 'forbidden' });
    const storage = (0, storage_1.getStorageService)();
    if (row.file_url)
        await storage.deleteFile(row.file_url);
    await postgres_1.pg.query('DELETE FROM reports WHERE id=$1', [id]);
    res.json({ deleted: true });
});
exports.default = router;
