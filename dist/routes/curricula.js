"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const postgres_1 = require("../config/postgres");
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middlewares/validate");
const env_1 = require("../config/env");
const cv_1 = require("../models/cv");
const cvVersion_1 = require("../models/cvVersion");
const crypto_1 = require("crypto");
const pdf_1 = require("../services/pdf");
const email_1 = require("../services/email");
const storage_1 = require("../services/storage");
const router = (0, express_1.Router)();
function parsePagination(q) {
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(50, Math.max(1, Number(q.limit || 10)));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}
const createSchema = joi_1.default.object({
    title: joi_1.default.string().required(),
    template: joi_1.default.string().valid('modern', 'classic', 'creative').default('modern'),
    personalInfo: joi_1.default.object({
        name: joi_1.default.string().required(),
        email: joi_1.default.string().email().required(),
        phone: joi_1.default.string().required()
    }).required()
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { page, limit, offset } = parsePagination(req.query);
    const filters = ['user_id=$1', 'deleted_at IS NULL'];
    const args = [uid];
    if (req.query.template) {
        filters.push('template=$' + (args.length + 1));
        args.push(String(req.query.template));
    }
    if (req.query.search) {
        filters.push('title ILIKE $' + (args.length + 1));
        args.push('%' + String(req.query.search) + '%');
    }
    const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
    const listQuery = `SELECT id, title, template, is_public, download_count, view_count, pdf_url, created_at, updated_at FROM curricula ${where} ORDER BY created_at DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`;
    const countQuery = `SELECT COUNT(*) FROM curricula ${where}`;
    const { rows } = await postgres_1.pg.query(listQuery, [...args, limit, offset]);
    const { rows: countRows } = await postgres_1.pg.query(countQuery, args);
    const total = Number(countRows[0].count);
    return res.json({ items: rows, page, limit, total });
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(createSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const shareToken = (0, crypto_1.randomBytes)(12).toString('hex');
    const { title, template, personalInfo } = req.body;
    const insert = `INSERT INTO curricula (user_id, title, template, is_public, share_token) VALUES ($1,$2,$3,$4,$5) RETURNING id`;
    const { rows } = await postgres_1.pg.query(insert, [uid, title, template || 'modern', false, shareToken]);
    const curriculaId = rows[0].id;
    const data = { nome: personalInfo.name, cargo: title, email: personalInfo.email, tel: personalInfo.phone };
    const cvDoc = await cv_1.CV.create({ userId: uid, curriculaId, ...data });
    await cvVersion_1.CVVersion.create({ userId: uid, curriculaId, data });
    return res.status(201).json({ id: curriculaId, shareToken });
});
router.get('/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT * FROM curricula WHERE id=$1 AND deleted_at IS NULL', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const cv = await cv_1.CV.findOne({ curriculaId: id });
    return res.json({ meta: rows[0], data: cv });
});
const updateSchema = joi_1.default.object({
    title: joi_1.default.string().min(2).optional(),
    template: joi_1.default.string().valid('modern', 'classic', 'creative').optional(),
    is_public: joi_1.default.boolean().optional(),
    personalInfo: joi_1.default.object({
        name: joi_1.default.string().optional(),
        email: joi_1.default.string().email().optional(),
        phone: joi_1.default.string().optional()
    }).optional()
});
router.put('/:id', auth_1.requireAuth, (0, validate_1.validate)(updateSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM curricula WHERE id=$1 AND deleted_at IS NULL', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const updates = [];
    const values = [];
    const fields = ['title', 'template', 'is_public'];
    fields.forEach(f => { if (req.body[f] !== undefined) {
        updates.push(`${f}=$${updates.length + 1}`);
        values.push(req.body[f]);
    } });
    if (updates.length) {
        values.push(id);
        const sql = `UPDATE curricula SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`;
        await postgres_1.pg.query(sql, values);
    }
    if (req.body.personalInfo) {
        const current = await cv_1.CV.findOne({ curriculaId: id });
        if (current)
            await cvVersion_1.CVVersion.create({ userId: uid, curriculaId: id, data: current.toObject() });
        const patch = {};
        if (req.body.personalInfo.name !== undefined)
            patch.nome = req.body.personalInfo.name;
        if (req.body.personalInfo.email !== undefined)
            patch.email = req.body.personalInfo.email;
        if (req.body.personalInfo.phone !== undefined)
            patch.tel = req.body.personalInfo.phone;
        await cv_1.CV.updateOne({ curriculaId: id }, { $set: patch });
    }
    return res.json({ ok: true });
});
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id FROM curricula WHERE id=$1', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    await postgres_1.pg.query('UPDATE curricula SET deleted_at=NOW(), is_public=false WHERE id=$1', [id]);
    return res.json({ ok: true });
});
router.post('/:id/generate-pdf', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const id = String(req.params.id);
    const { rows } = await postgres_1.pg.query('SELECT user_id, pdf_url, title, template FROM curricula WHERE id=$1 AND deleted_at IS NULL', [id]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    if (rows[0].user_id !== uid)
        return res.status(403).json({ error: 'forbidden' });
    const cv = await cv_1.CV.findOne({ curriculaId: id });
    if (!cv)
        return res.status(404).json({ error: 'not_found' });
    const pdf = (0, pdf_1.getPDFService)();
    const tpl = rows[0].template || 'modern';
    const buffer = await pdf.generateCurriculum({
        nome: cv.nome,
        cargo: cv.cargo,
        email: cv.email,
        tel: cv.tel,
        cep: cv.cep,
        cidade: cv.cidade,
        resumo: cv.resumo,
        empresa: cv.empresa,
        periodo: cv.periodo,
        atividades: cv.atividades
    }, tpl);
    const storage = (0, storage_1.getStorageService)();
    const key = `curricula/${uid}/${id}.pdf`;
    const url = await storage.uploadPDF(buffer, key);
    await postgres_1.pg.query('UPDATE curricula SET pdf_url=$1, download_count=download_count+1 WHERE id=$2', [url, id]);
    const svc = (0, email_1.getEmailService)();
    const userRes = await postgres_1.pg.query('SELECT id, email, name FROM users WHERE id=$1', [uid]);
    if (userRes.rows.length)
        await svc.sendCurriculumGenerated(userRes.rows[0], url);
    return res.json({ url });
});
router.get('/:id/share/:token', async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING || !env_1.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const id = String(req.params.id);
    const token = String(req.params.token);
    const { rows } = await postgres_1.pg.query('SELECT * FROM curricula WHERE id=$1 AND share_token=$2 AND is_public=true AND deleted_at IS NULL', [id, token]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    const cv = await cv_1.CV.findOne({ curriculaId: id });
    await postgres_1.pg.query('UPDATE curricula SET view_count=view_count+1 WHERE id=$1', [id]);
    return res.json({ meta: rows[0], data: cv });
});
exports.default = router;
