"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const postgres_1 = require("../config/postgres");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const joi_1 = __importDefault(require("joi"));
const validate_1 = require("../middlewares/validate");
const env_1 = require("../config/env");
const auth_1 = require("../middlewares/auth");
const crypto_1 = require("crypto");
const email_1 = require("../services/email");
const https_1 = __importDefault(require("https"));
const router = (0, express_1.Router)();
const registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    name: joi_1.default.string().min(2).required(),
    phone: joi_1.default.string().pattern(/^\d{10,11}$/).optional(),
    cpf: joi_1.default.string().pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/).optional(),
    cnpj: joi_1.default.string().optional()
});
function strongPassword(p) {
    const hasUpper = /[A-Z]/.test(p);
    const hasLower = /[a-z]/.test(p);
    const hasNum = /[0-9]/.test(p);
    const hasSpec = /[^A-Za-z0-9]/.test(p);
    return p.length >= 8 && hasUpper && hasLower && hasNum && hasSpec;
}
function issueAccessToken(uid) {
    return jsonwebtoken_1.default.sign({ uid }, env_1.env.JWT_SECRET, { expiresIn: '15m' });
}
async function issueRefreshToken(uid) {
    const token = (0, crypto_1.randomBytes)(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await postgres_1.pg.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)', [uid, token, expires]);
    return token;
}
router.post('/register', (0, validate_1.validate)(registerSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { email, password, name, phone, cpf, cnpj } = req.body;
    if (!strongPassword(password))
        return res.status(400).json({ error: 'weak_password' });
    const { rows: existing } = await postgres_1.pg.query('SELECT id, email_verified FROM users WHERE email=$1', [email]);
    if (existing.length) {
        if (existing[0].email_verified) {
            return res.status(409).json({ error: 'email_taken' });
        }
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const verificationToken = (0, crypto_1.randomBytes)(24).toString('hex');
    const verificationExpires = new Date(Date.now() + 60 * 60 * 1000);
    const insert = `
    INSERT INTO users (email, password_hash, name, phone, cpf, cnpj, email_verification_token, email_verification_expires, type) 
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) 
    ON CONFLICT (email) DO UPDATE 
    SET password_hash = $2, name = $3, phone = $4, cpf = $5, cnpj = $6, 
        email_verification_token = $7, email_verification_expires = $8, type = $9, updated_at = NOW()
    RETURNING id, email, name`;
    const { rows } = await postgres_1.pg.query(insert, [email, passwordHash, name, phone || null, cpf || null, cnpj || null, verificationToken, verificationExpires, 'customer']);
    const svc = (0, email_1.getEmailService)();
    await svc.sendVerificationEmail({ id: rows[0].id, email, name }, verificationToken);
    return res.status(200).json({ message: 'registration_successful' });
});
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
router.post('/login', (0, validate_1.validate)(loginSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { email, password } = req.body;
    const { rows } = await postgres_1.pg.query('SELECT id, password_hash, email_verified FROM users WHERE email=$1', [email]);
    if (!rows.length)
        return res.status(401).json({ error: 'invalid_credentials' });
    const user = rows[0];
    const ok = await bcryptjs_1.default.compare(password, user.password_hash);
    if (!ok)
        return res.status(401).json({ error: 'invalid_credentials' });
    if (!user.email_verified)
        return res.status(401).json({ error: 'email_not_verified' });
    const accessToken = issueAccessToken(user.id);
    const refreshToken = await issueRefreshToken(user.id);
    await postgres_1.pg.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
    return res.json({ accessToken, refreshToken });
});
router.post('/refresh-token', async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { refreshToken } = req.body || {};
    if (!refreshToken)
        return res.status(400).json({ error: 'missing_token' });
    const { rows } = await postgres_1.pg.query('SELECT user_id, expires_at FROM refresh_tokens WHERE token=$1', [refreshToken]);
    if (!rows.length)
        return res.status(401).json({ error: 'invalid_token' });
    if (new Date(rows[0].expires_at).getTime() < Date.now())
        return res.status(401).json({ error: 'expired_token' });
    const uid = rows[0].user_id;
    await postgres_1.pg.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]);
    const newRefresh = await issueRefreshToken(uid);
    const accessToken = issueAccessToken(uid);
    return res.json({ accessToken, refreshToken: newRefresh });
});
const forgotSchema = joi_1.default.object({ email: joi_1.default.string().email().required() });
router.post('/forgot-password', (0, validate_1.validate)(forgotSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { email } = req.body;
    const { rows } = await postgres_1.pg.query('SELECT id FROM users WHERE email=$1', [email]);
    if (!rows.length)
        return res.status(200).json({ ok: true });
    const uid = rows[0].id;
    const token = (0, crypto_1.randomBytes)(24).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await postgres_1.pg.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)', [uid, token, expires]);
    const svc = (0, email_1.getEmailService)();
    await svc.sendPasswordReset(email, token);
    return res.status(200).json({ ok: true });
});
const resetSchema = joi_1.default.object({ token: joi_1.default.string().required(), password: joi_1.default.string().min(8).required() });
router.post('/reset-password', (0, validate_1.validate)(resetSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { token, password } = req.body;
    if (!strongPassword(password))
        return res.status(400).json({ error: 'weak_password' });
    const { rows } = await postgres_1.pg.query('SELECT user_id, expires_at FROM password_resets WHERE token=$1', [token]);
    if (!rows.length)
        return res.status(400).json({ error: 'invalid_token' });
    if (new Date(rows[0].expires_at).getTime() < Date.now())
        return res.status(400).json({ error: 'expired_token' });
    const uid = rows[0].user_id;
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    await postgres_1.pg.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, uid]);
    await postgres_1.pg.query('DELETE FROM password_resets WHERE user_id=$1', [uid]);
    return res.json({ ok: true });
});
router.get('/me', auth_1.requireAuth, async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const uid = req.userId;
    const { rows } = await postgres_1.pg.query('SELECT id, email, name, user_type, phone, subscription_plan, subscription_status, created_at, updated_at, last_login FROM users WHERE id=$1', [uid]);
    if (!rows.length)
        return res.status(404).json({ error: 'not_found' });
    return res.json(rows[0]);
});
const verifyEmailSchema = joi_1.default.object({
    token: joi_1.default.string().required(),
});
router.get('/verify-email', (0, validate_1.validate)(verifyEmailSchema, 'query'), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { token } = req.query;
    const { rows } = await postgres_1.pg.query('SELECT id, email_verification_expires FROM users WHERE email_verification_token=$1', [token]);
    if (!rows.length)
        return res.status(400).json({ error: 'invalid_token' });
    const user = rows[0];
    if (new Date(user.email_verification_expires).getTime() < Date.now()) {
        return res.status(400).json({ error: 'expired_token' });
    }
    await postgres_1.pg.query('UPDATE users SET email_verified=true, email_verification_token=null, email_verification_expires=null, updated_at=NOW() WHERE id=$1', [user.id]);
    const accessToken = issueAccessToken(user.id);
    const refreshToken = await issueRefreshToken(user.id);
    return res.json({ accessToken, refreshToken });
});
router.post('/firebase-login', async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== 'string')
        return res.status(400).json({ error: 'missing_token' });
    if (!env_1.env.FIREBASE_PROJECT_ID)
        return res.status(500).json({ error: 'firebase_not_configured' });
    try {
        const decoded = jsonwebtoken_1.default.decode(idToken, { complete: true });
        const kid = decoded?.header?.kid;
        if (!kid)
            return res.status(401).json({ error: 'invalid_token' });
        function getJSON(url) {
            return new Promise((resolve, reject) => {
                https_1.default.get(url, (resp) => {
                    if (resp.statusCode && resp.statusCode >= 400) {
                        reject(new Error('status_' + resp.statusCode));
                        return;
                    }
                    let data = '';
                    resp.on('data', (chunk) => { data += chunk; });
                    resp.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        }
                        catch (e) {
                            reject(e);
                        }
                    });
                }).on('error', reject);
            });
        }
        let certs;
        try {
            certs = await getJSON('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
        }
        catch {
            return res.status(502).json({ error: 'certs_fetch_failed' });
        }
        const cert = certs[kid];
        if (!cert)
            return res.status(401).json({ error: 'invalid_token' });
        const verified = jsonwebtoken_1.default.verify(idToken, cert, {
            algorithms: ['RS256'],
            audience: env_1.env.FIREBASE_PROJECT_ID,
            issuer: 'https://securetoken.google.com/' + env_1.env.FIREBASE_PROJECT_ID
        });
        const email = String(verified.email || '');
        const name = String(verified.name || '');
        const uidProvider = String(verified.user_id || verified.sub || '');
        if (!email)
            return res.status(400).json({ error: 'email_required' });
        let userId = null;
        const existing = await postgres_1.pg.query('SELECT id FROM users WHERE email=$1', [email]);
        if (existing.rows.length) {
            userId = existing.rows[0].id;
        }
        else {
            const insert = `INSERT INTO users (email, name, email_verified, type) VALUES ($1,$2,$3,$4) RETURNING id`;
            const ins = await postgres_1.pg.query(insert, [email, name || null, true, 'customer']);
            userId = ins.rows[0].id;
        }
        const accessToken = issueAccessToken(userId);
        const refreshToken = await issueRefreshToken(userId);
        await postgres_1.pg.query('UPDATE users SET last_login=NOW(), provider_uid=$2 WHERE id=$1', [userId, uidProvider || null]);
        return res.json({ accessToken, refreshToken });
    }
    catch (e) {
        return res.status(401).json({ error: 'invalid_token' });
    }
});
const bootstrapAdminSchema = joi_1.default.object({
    secret: joi_1.default.string().required(),
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    name: joi_1.default.string().min(2).required()
});
router.post('/bootstrap-admin', (0, validate_1.validate)(bootstrapAdminSchema), async (req, res) => {
    if (!env_1.env.PG_CONNECTION_STRING)
        return res.status(503).json({ error: 'db_unavailable' });
    const { secret, email, password, name } = req.body;
    if (!env_1.env.BACKUP_SECRET || secret !== env_1.env.BACKUP_SECRET)
        return res.status(403).json({ error: 'forbidden' });
    const existing = await postgres_1.pg.query('SELECT id, user_type FROM users WHERE email=$1', [email]);
    let id;
    const password_hash = await bcryptjs_1.default.hash(password, 10);
    if (existing.rows.length) {
        id = existing.rows[0].id;
        await postgres_1.pg.query("UPDATE users SET password_hash=$1, name=$2, email_verified=true, user_type='admin', updated_at=NOW() WHERE id=$3", [password_hash, name, id]);
    }
    else {
        const ins = await postgres_1.pg.query("INSERT INTO users (email, password_hash, name, email_verified, user_type) VALUES ($1,$2,$3,$4,$5) RETURNING id", [email, password_hash, name, true, 'admin']);
        id = ins.rows[0].id;
    }
    await postgres_1.pg.query('UPDATE users SET last_login=NOW() WHERE id=$1', [id]);
    const accessToken = issueAccessToken(id);
    const refreshToken = await issueRefreshToken(id);
    return res.json({ id, email, name, accessToken, refreshToken });
});
exports.default = router;
