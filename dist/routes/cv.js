"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middlewares/validate");
const auth_1 = require("../middlewares/auth");
const cv_1 = require("../models/cv");
const router = (0, express_1.Router)();
const cvSchema = joi_1.default.object({
    nome: joi_1.default.string().required(),
    cargo: joi_1.default.string().required(),
    email: joi_1.default.string().email().required(),
    tel: joi_1.default.string().required(),
    cep: joi_1.default.string().optional(),
    cidade: joi_1.default.string().optional(),
    resumo: joi_1.default.string().optional(),
    empresa: joi_1.default.string().optional(),
    periodo: joi_1.default.string().optional(),
    atividades: joi_1.default.string().optional()
});
router.post('/', auth_1.requireAuth, (0, validate_1.validate)(cvSchema), async (req, res) => {
    if (!process.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const userId = req.userId;
    const doc = await cv_1.CV.create({ userId, ...req.body });
    return res.status(201).json({ id: String(doc._id) });
});
router.get('/', auth_1.requireAuth, async (req, res) => {
    if (!process.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const userId = req.userId;
    const list = await cv_1.CV.find({ userId }).sort({ createdAt: -1 });
    return res.json({ items: list });
});
const cvUpdateSchema = joi_1.default.object({
    nome: joi_1.default.string().optional(),
    cargo: joi_1.default.string().optional(),
    email: joi_1.default.string().email().optional(),
    tel: joi_1.default.string().optional(),
    cep: joi_1.default.string().optional(),
    cidade: joi_1.default.string().optional(),
    resumo: joi_1.default.string().optional(),
    empresa: joi_1.default.string().optional(),
    periodo: joi_1.default.string().optional(),
    atividades: joi_1.default.string().optional()
});
router.put('/by-curricula/:curriculaId', auth_1.requireAuth, (0, validate_1.validate)(cvUpdateSchema), async (req, res) => {
    if (!process.env.MONGO_URI)
        return res.status(503).json({ error: 'db_unavailable' });
    const userId = req.userId;
    const curriculaId = String(req.params.curriculaId);
    const existing = await cv_1.CV.findOne({ userId, curriculaId });
    if (!existing)
        return res.status(404).json({ error: 'not_found' });
    await cv_1.CV.updateOne({ userId, curriculaId }, { $set: req.body });
    return res.json({ ok: true });
});
exports.default = router;
