import { env } from '../config/env'
import { User } from '../types/user'

export interface EmailService {
  sendWelcomeEmail(user: User): Promise<void>
  sendPasswordReset(email: string, token: string): Promise<void>
  sendCurriculumGenerated(user: User, curriculumUrl: string): Promise<void>
  sendVerificationEmail(user: User, token: string): Promise<void>
}

class ConsoleEmailService implements EmailService {
  async sendWelcomeEmail(user: User) { }
  async sendPasswordReset(email: string, token: string) { }
  async sendCurriculumGenerated(user: User, curriculumUrl: string) { }
  async sendVerificationEmail(user: User, token: string) {
    console.log(`Verification email for ${user.email} with token ${token}`)
  }
}

class SMTPEmailService implements EmailService {
  async sendWelcomeEmail(user: User) {
    await this.send(user.email, 'Bem-vindo à Plena Digital', `Olá ${user.name}`)
  }
  async sendPasswordReset(email: string, token: string) {
    await this.send(email, 'Reset de senha', `Token: ${token}`)
  }
  async sendCurriculumGenerated(user: User, curriculumUrl: string) {
    await this.send(user.email, 'Currículo gerado', curriculumUrl)
  }
  async sendVerificationEmail(user: User, token: string): Promise<void> {
    const verificationLink = `https://plena.digital/verify-email?token=${token}`
    await this.send(user.email, 'Verifique seu e-mail', `Olá ${user.name}, por favor verifique seu e-mail clicando no link: ${verificationLink}`)
  }
  private async send(to: string, subject: string, text: string) {
    const nodemailer = await import('nodemailer') as any
    const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
    await transporter.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, text })
  }
}

class SendGridEmailService implements EmailService {
  async sendWelcomeEmail(user: User) { await this.send(user.email, 'Bem-vindo à Plena Digital', `Olá ${user.name}`) }
  async sendPasswordReset(email: string, token: string) { await this.send(email, 'Reset de senha', `Token: ${token}`) }
  async sendCurriculumGenerated(user: User, curriculumUrl: string) { await this.send(user.email, 'Currículo gerado', curriculumUrl) }
  async sendVerificationEmail(user: User, token: string): Promise<void> {
    const verificationLink = `https://plena.digital/verify-email?token=${token}`
    await this.send(user.email, 'Verifique seu e-mail', `Olá ${user.name}, por favor verifique seu e-mail clicando no link: ${verificationLink}`)
  }
  private async send(to: string, subject: string, text: string) {
    const sg = await import('@sendgrid/mail')
    ;(sg as any).setApiKey(env.SENDGRID_API_KEY)
    await (sg as any).send({ to, from: env.SMTP_FROM || env.SMTP_USER, subject, text })
  }
}

export function getEmailService(): EmailService {
  if (env.SENDGRID_API_KEY) return new SendGridEmailService()
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return new SMTPEmailService()
  return new ConsoleEmailService()
}