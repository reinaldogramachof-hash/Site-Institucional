import { pg } from '../config/postgres'
import { env } from '../config/env'

export type Appointment = {
  user_id: string
  service_type: string
  scheduled_date: Date
  duration: number
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string | null
  location_type?: 'in_person' | 'online'
  address?: string | null
  online_meeting_url?: string | null
}

export type TimeSlot = { start: Date; end: Date }

export interface CalendarService {
  createEvent(appointment: Appointment): Promise<string>
  updateEvent(eventId: string, appointment: Appointment): Promise<void>
  deleteEvent(eventId: string): Promise<void>
  getAvailableSlots(date: Date, duration: number): Promise<TimeSlot[]>
}

class DefaultCalendarService implements CalendarService {
  userId: string
  constructor(userId: string) { this.userId = userId }
  async createEvent(a: Appointment) {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const sql = 'INSERT INTO appointments (user_id, service_type, scheduled_date, duration, status, notes, location_type, address, online_meeting_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id'
    const { rows } = await pg.query(sql, [a.user_id, a.service_type, a.scheduled_date, a.duration, a.status || 'pending', a.notes || null, a.location_type || 'in_person', a.address || null, a.online_meeting_url || null])
    return rows[0].id as string
  }
  async updateEvent(eventId: string, a: Appointment) {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const set: string[] = []
    const vals: any[] = []
    const data: any = a
    ;['service_type','scheduled_date','duration','status','notes','location_type','address','online_meeting_url'].forEach(k => { if (data[k] !== undefined) { set.push(`${k}=$${set.length+1}`); vals.push(data[k]) } })
    if (!set.length) return
    vals.push(eventId)
    const sql = `UPDATE appointments SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`
    await pg.query(sql, vals)
  }
  async deleteEvent(eventId: string) {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    await pg.query("UPDATE appointments SET status='cancelled', updated_at=NOW() WHERE id=$1", [eventId])
  }
  async getAvailableSlots(date: Date, duration: number) {
    if (!env.PG_CONNECTION_STRING) throw new Error('db_unavailable')
    const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    const base = new Date(day + 'T00:00:00')
    const open = new Date(base); open.setHours(9, 0, 0, 0)
    const close = new Date(base); close.setHours(18, 0, 0, 0)
    const q = await pg.query("SELECT scheduled_date, duration FROM appointments WHERE user_id=$1 AND scheduled_date::date=$2 AND status IN ('pending','confirmed')", [this.userId, day])
    const busy: { start: Date; end: Date }[] = q.rows.map(r => ({ start: new Date(r.scheduled_date), end: new Date(new Date(r.scheduled_date).getTime() + Number(r.duration) * 60000) }))
    const slots: TimeSlot[] = []
    const step = 30
    for (let t = open.getTime(); t + duration * 60000 <= close.getTime(); t += step * 60000) {
      const s = new Date(t)
      const e = new Date(t + duration * 60000)
      const conflict = busy.some(b => s < b.end && e > b.start)
      if (!conflict) slots.push({ start: s, end: e })
    }
    return slots
  }
}

export function getCalendarService(userId: string): CalendarService { return new DefaultCalendarService(userId) }
export async function validateAppointment(scheduledDate: Date, duration: number): Promise<boolean> {
  const day = scheduledDate.getDay()
  if (day === 0 || day === 6) return false
  const start = new Date(scheduledDate.getTime())
  const end = new Date(scheduledDate.getTime() + duration * 60000)
  const open = new Date(scheduledDate)
  open.setHours(9, 0, 0, 0)
  const close = new Date(scheduledDate)
  close.setHours(18, 0, 0, 0)
  if (start < open) return false
  if (end > close) return false
  return true
}