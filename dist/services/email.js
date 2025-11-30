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
exports.getEmailService = getEmailService;
const env_1 = require("../config/env");
class ConsoleEmailService {
    async sendWelcomeEmail(user) { }
    async sendPasswordReset(email, token) { }
    async sendCurriculumGenerated(user, curriculumUrl) { }
    async sendVerificationEmail(user, token) {
        console.log(`Verification email for ${user.email} with token ${token}`);
    }
}
class SMTPEmailService {
    async sendWelcomeEmail(user) {
        await this.send(user.email, 'Bem-vindo à Plena Digital', `Olá ${user.name}`);
    }
    async sendPasswordReset(email, token) {
        await this.send(email, 'Reset de senha', `Token: ${token}`);
    }
    async sendCurriculumGenerated(user, curriculumUrl) {
        await this.send(user.email, 'Currículo gerado', curriculumUrl);
    }
    async sendVerificationEmail(user, token) {
        const verificationLink = `https://plena.digital/verify-email?token=${token}`;
        await this.send(user.email, 'Verifique seu e-mail', `Olá ${user.name}, por favor verifique seu e-mail clicando no link: ${verificationLink}`);
    }
    async send(to, subject, text) {
        const nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
        const transporter = nodemailer.createTransport({ host: env_1.env.SMTP_HOST, port: env_1.env.SMTP_PORT, secure: env_1.env.SMTP_PORT === 465, auth: { user: env_1.env.SMTP_USER, pass: env_1.env.SMTP_PASS } });
        await transporter.sendMail({ from: env_1.env.SMTP_FROM || env_1.env.SMTP_USER, to, subject, text });
    }
}
class SendGridEmailService {
    async sendWelcomeEmail(user) { await this.send(user.email, 'Bem-vindo à Plena Digital', `Olá ${user.name}`); }
    async sendPasswordReset(email, token) { await this.send(email, 'Reset de senha', `Token: ${token}`); }
    async sendCurriculumGenerated(user, curriculumUrl) { await this.send(user.email, 'Currículo gerado', curriculumUrl); }
    async sendVerificationEmail(user, token) {
        const verificationLink = `https://plena.digital/verify-email?token=${token}`;
        await this.send(user.email, 'Verifique seu e-mail', `Olá ${user.name}, por favor verifique seu e-mail clicando no link: ${verificationLink}`);
    }
    async send(to, subject, text) {
        const sg = await Promise.resolve().then(() => __importStar(require('@sendgrid/mail')));
        sg.setApiKey(env_1.env.SENDGRID_API_KEY);
        await sg.send({ to, from: env_1.env.SMTP_FROM || env_1.env.SMTP_USER, subject, text });
    }
}
function getEmailService() {
    if (env_1.env.SENDGRID_API_KEY)
        return new SendGridEmailService();
    if (env_1.env.SMTP_HOST && env_1.env.SMTP_USER && env_1.env.SMTP_PASS)
        return new SMTPEmailService();
    return new ConsoleEmailService();
}
