"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupJob = backupJob;
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const storage_1 = require("../services/storage");
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
function fmt(ts) {
    const yyyy = ts.getFullYear();
    const mm = String(ts.getMonth() + 1).padStart(2, '0');
    const dd = String(ts.getDate()).padStart(2, '0');
    const hh = String(ts.getHours()).padStart(2, '0');
    const mi = String(ts.getMinutes()).padStart(2, '0');
    const ss = String(ts.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;
}
async function exportCriticalData() {
    const res = {};
    const tables = [
        'users', 'curricula', 'appointments', 'payments', 'mei_services', 'mei_invoices', 'mei_nfes',
        'notifications', 'support_tickets', 'ticket_messages', 'reports'
    ];
    for (const t of tables) {
        const q = await postgres_1.pg.query(`SELECT * FROM ${t}`);
        res[t] = q.rows;
    }
    return res;
}
function encrypt(data) {
    const secret = env_1.env.BACKUP_SECRET || env_1.env.JWT_SECRET;
    const key = (0, crypto_1.createHash)('sha256').update(secret).digest(); // 32 bytes
    const iv = (0, crypto_1.randomBytes)(16);
    const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, iv);
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, enc]);
}
async function backupJob() {
    if (!env_1.env.PG_CONNECTION_STRING)
        throw new Error('db_unavailable');
    const storage = (0, storage_1.getStorageService)();
    const ts = new Date();
    const name = fmt(ts);
    const data = await exportCriticalData();
    const json = Buffer.from(JSON.stringify({ generated_at: ts.toISOString(), data }), 'utf8');
    const gz = (0, zlib_1.gzipSync)(json);
    const enc = encrypt(gz);
    const url = await storage.uploadFile(enc, `backup/${name}_backup.bin`, 'application/octet-stream');
    return { url, size: enc.length };
}
