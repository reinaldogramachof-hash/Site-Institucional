"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.authorize = authorize;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const accessLog_1 = require("../models/accessLog");
const postgres_1 = require("../config/postgres");
const ioredis_1 = __importDefault(require("ioredis"));
const memory = new Map();
const redis = env_1.env.REDIS_URL ? new ioredis_1.default(env_1.env.REDIS_URL) : undefined;
async function rateLimit(uid) {
    const key = `rl:${uid}`;
    const limit = 60;
    const windowSec = 60;
    if (redis) {
        const tx = redis.multi();
        tx.incr(key);
        tx.expire(key, windowSec);
        const res = await tx.exec();
        const cnt = Number(res?.[0]?.[1] || 0);
        return cnt <= limit;
    }
    const now = Date.now();
    const v = memory.get(key);
    if (!v || v.resetAt < now) {
        memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
        return true;
    }
    v.count += 1;
    return v.count <= limit;
}
function authenticateToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header)
        return res.status(401).json({ error: 'unauthorized' });
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer')
        return res.status(401).json({ error: 'unauthorized' });
    try {
        const payload = jsonwebtoken_1.default.verify(parts[1], env_1.env.JWT_SECRET);
        req.userId = payload.uid;
    }
    catch {
        return res.status(401).json({ error: 'unauthorized' });
    }
    accessLog_1.AccessLog.create({ userId: req.userId, method: req.method, path: req.path, ip: req.ip }).catch(() => { });
    rateLimit(req.userId).then(ok => { if (!ok)
        return res.status(429).json({ error: 'rate_limited' }); next(); }).catch(() => res.status(500).json({ error: 'rate_limit_error' }));
}
function authorize(allowedRoles) {
    return async (req, res, next) => {
        const uid = req.userId;
        if (!uid)
            return res.status(401).json({ error: 'unauthorized' });
        if (!env_1.env.PG_CONNECTION_STRING)
            return res.status(503).json({ error: 'db_unavailable' });
        const { rows } = await postgres_1.pg.query('SELECT user_type FROM users WHERE id=$1', [uid]);
        if (!rows.length)
            return res.status(404).json({ error: 'not_found' });
        const role = rows[0].user_type;
        if (!allowedRoles.includes(role))
            return res.status(403).json({ error: 'forbidden' });
        next();
    };
}
