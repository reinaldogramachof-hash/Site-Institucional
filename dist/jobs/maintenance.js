"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupJob = cleanupJob;
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const storage_1 = require("../services/storage");
function toCSV(rows, columns) {
    const esc = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        if (/[",\n]/.test(s))
            return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    const header = columns.map(c => c.title).join(',');
    const lines = rows.map(r => columns.map(c => esc(r[c.key])).join(','));
    return Buffer.from([header, ...lines].join('\n'), 'utf8');
}
async function cleanupLogs() {
    if (!env_1.env.PG_CONNECTION_STRING)
        return;
    await postgres_1.pg.query("DELETE FROM admin_logs WHERE created_at < NOW() - INTERVAL '90 days'");
}
async function cleanupCache() {
    if (!env_1.env.REDIS_URL)
        return;
    const Redis = (await Promise.resolve().then(() => __importStar(require('ioredis')))).default;
    const redis = new Redis(env_1.env.REDIS_URL);
    const stream = redis.scanStream({ match: 'cache:*', count: 100 });
    const keys = [];
    await new Promise((resolve, reject) => {
        stream.on('data', (k) => { keys.push(...k); });
        stream.on('end', () => resolve());
        stream.on('error', err => reject(err));
    });
    if (keys.length)
        await redis.del(...keys);
    await redis.quit();
}
async function archiveInactiveData() {
    if (!env_1.env.PG_CONNECTION_STRING)
        return;
    const storage = (0, storage_1.getStorageService)();
    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const tickets = await postgres_1.pg.query("SELECT id, user_id, subject, status, priority, assigned_to, updated_at FROM support_tickets WHERE status='closed' AND updated_at < NOW() - INTERVAL '180 days' ORDER BY updated_at DESC");
    if (tickets.rows.length) {
        const buf = toCSV(tickets.rows, [
            { key: 'id', title: 'id' },
            { key: 'user_id', title: 'user_id' },
            { key: 'subject', title: 'subject' },
            { key: 'status', title: 'status' },
            { key: 'priority', title: 'priority' },
            { key: 'assigned_to', title: 'assigned_to' },
            { key: 'updated_at', title: 'updated_at' }
        ]);
        await storage.uploadFile(buf, `archive/${ymd}_support_tickets.csv`, 'text/csv');
    }
    const notifications = await postgres_1.pg.query("SELECT id, user_id, title, message, type, created_at FROM notifications WHERE is_read=true AND created_at < NOW() - INTERVAL '180 days' ORDER BY created_at DESC");
    if (notifications.rows.length) {
        const buf = toCSV(notifications.rows, [
            { key: 'id', title: 'id' },
            { key: 'user_id', title: 'user_id' },
            { key: 'title', title: 'title' },
            { key: 'message', title: 'message' },
            { key: 'type', title: 'type' },
            { key: 'created_at', title: 'created_at' }
        ]);
        await storage.uploadFile(buf, `archive/${ymd}_notifications.csv`, 'text/csv');
    }
}
async function cleanupJob() {
    await cleanupLogs();
    await cleanupCache();
    await archiveInactiveData();
}
