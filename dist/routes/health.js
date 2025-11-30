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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const env_1 = require("../config/env");
const postgres_1 = require("../config/postgres");
const storage_1 = require("../services/storage");
const os_1 = __importDefault(require("os"));
const perf_hooks_1 = require("perf_hooks");
const router = (0, express_1.Router)();
const eld = (0, perf_hooks_1.monitorEventLoopDelay)({ resolution: 20 });
eld.enable();
router.get('/', async (req, res) => {
    const start = Date.now();
    let db = { ok: false };
    let redis = { ok: false };
    let s3 = { ok: false };
    try {
        if (env_1.env.PG_CONNECTION_STRING) {
            await postgres_1.pg.query('SELECT 1');
            db.ok = true;
        }
        else
            db = { ok: false, error: 'db_unconfigured' };
    }
    catch (e) {
        db = { ok: false, error: String(e?.message || e) };
    }
    try {
        if (env_1.env.REDIS_URL) {
            const Redis = (await Promise.resolve().then(() => __importStar(require('ioredis')))).default;
            const r = new Redis(env_1.env.REDIS_URL);
            const pong = await r.ping();
            await r.quit();
            redis.ok = pong?.toLowerCase?.() === 'pong';
        }
        else
            redis = { ok: false, error: 'redis_unconfigured' };
    }
    catch (e) {
        redis = { ok: false, error: String(e?.message || e) };
    }
    try {
        const storage = (0, storage_1.getStorageService)();
        const key = `health/${Date.now()}_${Math.random().toString(16).slice(2)}.txt`;
        const url = await storage.uploadFile(Buffer.from('ok'), key, 'text/plain');
        await storage.deleteFile(url);
        s3.ok = true;
    }
    catch (e) {
        s3 = { ok: false, error: String(e?.message || e) };
    }
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const uptime = process.uptime();
    const perf = {
        uptime_seconds: Number(uptime.toFixed(0)),
        memory_rss_mb: Number((mem.rss / 1024 / 1024).toFixed(1)),
        memory_heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
        cpu_user_ms: Math.round(cpu.user / 1000),
        cpu_system_ms: Math.round(cpu.system / 1000),
        event_loop_delay_mean_ms: Number((eld.mean / 1e6).toFixed(2)),
        event_loop_delay_max_ms: Number((eld.max / 1e6).toFixed(2)),
        response_time_ms: Date.now() - start,
        loadavg: os_1.default.loadavg()
    };
    res.json({ services: { db, redis, storage: s3 }, perf });
});
exports.default = router;
