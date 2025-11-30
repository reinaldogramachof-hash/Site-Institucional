import { pg } from '../config/postgres'
import { Request } from 'express'
import { getNotificationService } from './notification'

export async function logAdminAction(adminId: string, action: string, resourceType: string, resourceId?: string, details?: any, req?: Request) {
  const ip = req?.ip || null
  const ua = req?.headers['user-agent'] || null
  const when = new Date()
  const reasons: string[] = []
  const critical = ['delete','remove','disable','export','assign_admin','change_role']
  const sensitive = ['user','payments','mei_services','reports']
  if (critical.includes(String(action).toLowerCase()) && sensitive.includes(String(resourceType).toLowerCase())) reasons.push('critical_action')
  const hr = when.getHours()
  if (hr < 7 || hr > 21) reasons.push('outside_business_hours')
  const extra = details ? { ...details } : {}
  if (reasons.length) extra.suspicious = { reasons, at: when.toISOString(), ip, ua }
  await pg.query('INSERT INTO admin_logs (admin_id, action, resource_type, resource_id, details, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)', [adminId, action, resourceType, resourceId || null, Object.keys(extra).length ? JSON.stringify(extra) : (details ? JSON.stringify(details) : null), ip, ua])
  if (reasons.length) {
    const notif = getNotificationService()
    const title = 'Alerta: ação administrativa suspeita'
    const message = `admin=${adminId} action=${action} resource=${resourceType} reasons=${reasons.join('|')}`
    await notif.sendToAdmins({ title, message, type: 'warning', related_service: 'admin_logs', related_id: resourceId || undefined })
  }
}