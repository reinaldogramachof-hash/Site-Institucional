import { pg } from '../config/postgres'
import { env } from '../config/env'

async function sendEmail(to: string, subject: string, text: string) {
  if (env.SENDGRID_API_KEY) {
    const sg = await import('@sendgrid/mail')
    ;(sg as any).setApiKey(env.SENDGRID_API_KEY)
    await (sg as any).send({ to, from: env.SMTP_FROM || env.SMTP_USER, subject, text })
    return
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const nodemailer = await import('nodemailer') as any
    const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } })
    await transporter.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, text })
    return
  }
}

export async function sendAppointmentReminders() {
  if (!env.PG_CONNECTION_STRING) return
  const now = new Date()
  const w24Start = new Date(now.getTime() + 24 * 3600 * 1000)
  const w24End = new Date(w24Start.getTime() + 10 * 60 * 1000)
  const r24 = await pg.query(
    "SELECT a.id, a.user_id, a.scheduled_date, a.duration, u.email, u.name FROM appointments a JOIN users u ON u.id=a.user_id WHERE a.status IN ('pending','confirmed') AND a.reminder_24h_sent=false AND a.scheduled_date >= $1 AND a.scheduled_date < $2",
    [w24Start, w24End]
  )
  for (const row of r24.rows) {
    const start = new Date(row.scheduled_date)
    const end = new Date(start.getTime() + Number(row.duration) * 60000)
    const subject = 'Lembrete de agendamento (24h)'
    const text = `Olá ${row.name}, seu agendamento está marcado para ${start.toISOString()}. Duração: ${row.duration} minutos.`
    if (row.email) await sendEmail(row.email, subject, text)
    await pg.query('UPDATE appointments SET reminder_24h_sent=true, updated_at=NOW() WHERE id=$1', [row.id])
  }
  const w1Start = new Date(now.getTime() + 3600 * 1000)
  const w1End = new Date(w1Start.getTime() + 10 * 60 * 1000)
  const r1 = await pg.query(
    "SELECT a.id, a.user_id, a.scheduled_date, a.duration, u.email, u.name FROM appointments a JOIN users u ON u.id=a.user_id WHERE a.status IN ('pending','confirmed') AND a.reminder_1h_sent=false AND a.scheduled_date >= $1 AND a.scheduled_date < $2",
    [w1Start, w1End]
  )
  for (const row of r1.rows) {
    const start = new Date(row.scheduled_date)
    const subject = 'Lembrete de agendamento (1h)'
    const text = `Olá ${row.name}, seu agendamento começa em 1 hora (${start.toISOString()}).`
    if (row.email) await sendEmail(row.email, subject, text)
    await pg.query('UPDATE appointments SET reminder_1h_sent=true, reminder_sent=true, updated_at=NOW() WHERE id=$1', [row.id])
  }
}