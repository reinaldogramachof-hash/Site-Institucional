"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const rate_1 = require("./middlewares/rate");
const env_1 = require("./config/env");
const postgres_1 = require("./config/postgres");
const mongo_1 = require("./config/mongo");
const auth_1 = __importDefault(require("./routes/auth"));
const cv_1 = __importDefault(require("./routes/cv"));
const users_1 = __importDefault(require("./routes/users"));
const curricula_1 = __importDefault(require("./routes/curricula"));
const mei_1 = __importDefault(require("./routes/mei"));
const appointments_1 = __importDefault(require("./routes/appointments"));
const payments_1 = __importDefault(require("./routes/payments"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const reports_1 = __importDefault(require("./routes/reports"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const support_1 = __importDefault(require("./routes/support"));
const admin_1 = __importDefault(require("./routes/admin"));
const health_1 = __importDefault(require("./routes/health"));
async function start() {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN }));
    app.use(express_1.default.json());
    app.use(express_1.default.static(process.cwd()));
    app.get('/health', (req, res) => res.json({ ok: true }));
    app.use('/api/health', health_1.default);
    app.use('/api/auth', rate_1.clientLimiter, auth_1.default);
    app.use('/api/cv', rate_1.clientLimiter, cv_1.default);
    app.use('/api/users', rate_1.clientLimiter, users_1.default);
    app.use('/api/curricula', rate_1.clientLimiter, curricula_1.default);
    app.use('/api/mei', rate_1.clientLimiter, mei_1.default);
    app.use('/api/appointments', rate_1.clientLimiter, appointments_1.default);
    app.use('/api/payments', rate_1.clientLimiter, payments_1.default);
    app.use('/api/dashboard', rate_1.clientLimiter, dashboard_1.default);
    app.use('/api/reports', rate_1.clientLimiter, reports_1.default);
    app.use('/api/notifications', rate_1.clientLimiter, notifications_1.default);
    app.use('/api/support', rate_1.supportLimiter, support_1.default);
    app.use('/api/admin', rate_1.adminLimiter, admin_1.default);
    app.listen(env_1.env.PORT, () => {
        console.log(`Server listening on http://localhost:${env_1.env.PORT}/`);
    });
    setImmediate(async () => {
        try {
            await (0, postgres_1.migrate)();
        }
        catch { }
        try {
            await (0, mongo_1.connectMongo)();
        }
        catch { }
    });
}
start();
