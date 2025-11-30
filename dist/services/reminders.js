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
exports.sendAppointmentReminders = sendAppointmentReminders;
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
async function sendEmail(to, subject, text) {
    if (env_1.env.SENDGRID_API_KEY) {
        const sg = await Promise.resolve().then(() => __importStar(require('@sendgrid/mail')));
        sg.setApiKey(env_1.env.SENDGRID_API_KEY);
        await sg.send({ to, from: env_1.env.SMTP_FROM || env_1.env.SMTP_USER, subject, text });
        return;
    }
    if (env_1.env.SMTP_HOST && env_1.env.SMTP_USER && env_1.env.SMTP_PASS) {
        const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
        const transporter = nodemailer.createTransport({ host: env_1.env.SMTP_HOST, port: env_1.env.SMTP_PORT, secure: env_1.env.SMTP_PORT === 465, auth: { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS } });
        await transporter.sendMail({ from: env_1.env.SMTP_FROM || env_1.env.SMTP_USER, to, subject, text });
        return;
    }
}
async function sendAppointmentReminders() {
    if (!env_1.env.PG_CONNECTION_STRING)
        return;
    const now = new Date();
    const w24Start = new Date(now.getTime() + 24 * 3600 * 1000);
    const w24End = new Date(w24Start.getTime() + 10 * 60 * 1000);
    const r24 = await postgres_1.pg.query("SELECT a.id, a.user_id, a.scheduled_date, a.duration, u.email, u.name FROM appointments a JOIN users u ON u.id=a.user_id WHERE a.status IN ('pending','confirmed') AND a.reminder_24h_sent=false AND a.scheduled_date >= $1 AND a.scheduled_date < $2", [w24Start, w24End]);
    for (const row of r24.rows) {
        const start = new Date(row.scheduled_date);
        const end = new Date(start.getTime() + Number(row.duration) * 60000);
        const subject = 'Lembrete de agendamento (24h)';
        const text = `Olá ${row.name}, seu agendamento está marcado para ${start.toISOString()}. Duração: ${row.duration} minutos.`;
        if (row.email)
            await sendEmail(row.email, subject, text);
        await postgres_1.pg.query('UPDATE appointments SET reminder_24h_sent=true, updated_at=NOW() WHERE id=$1', [row.id]);
    }
    const w1Start = new Date(now.getTime() + 3600 * 1000);
    const w1End = new Date(w1Start.getTime() + 10 * 60 * 1000);
    const r1 = await postgres_1.pg.query("SELECT a.id, a.user_id, a.scheduled_date, a.duration, u.email, u.name FROM appointments a JOIN users u ON u.id=a.user_id WHERE a.status IN ('pending','confirmed') AND a.reminder_1h_sent=false AND a.scheduled_date >= $1 AND a.scheduled_date < $2", [w1Start, w1End]);
    for (const row of r1.rows) {
        const start = new Date(row.scheduled_date);
        const subject = 'Lembrete de agendamento (1h)';
        const text = `Olá ${row.name}, seu agendamento começa em 1 hora (${start.toISOString()}).`;
        if (row.email)
            await sendEmail(row.email, subject, text);
        await postgres_1.pg.query('UPDATE appointments SET reminder_1h_sent=true, reminder_sent=true, updated_at=NOW() WHERE id=$1', [row.id]);
    }
}
