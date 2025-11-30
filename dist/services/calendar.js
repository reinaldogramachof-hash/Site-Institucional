"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarService = getCalendarService;
exports.validateAppointment = validateAppointment;
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
class DefaultCalendarService {
    constructor(userId) { this.userId = userId; }
    async createEvent(a) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const sql = 'INSERT INTO appointments (user_id, service_type, scheduled_date, duration, status, notes, location_type, address, online_meeting_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id';
        const { rows } = await postgres_1.pg.query(sql, [a.user_id, a.service_type, a.scheduled_date, a.duration, a.status || 'pending', a.notes || null, a.location_type || 'in_person', a.address || null, a.online_meeting_url || null]);
        return rows[0].id;
    }
    async updateEvent(eventId, a) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const set = [];
        const vals = [];
        const data = a;
        ['service_type', 'scheduled_date', 'duration', 'status', 'notes', 'location_type', 'address', 'online_meeting_url'].forEach(k => { if (data[k] !== undefined) {
            set.push(`${k}=$${set.length + 1}`);
            vals.push(data[k]);
        } });
        if (!set.length)
            return;
        vals.push(eventId);
        const sql = `UPDATE appointments SET ${set.join(', ')}, updated_at=NOW() WHERE id=$${vals.length}`;
        await postgres_1.pg.query(sql, vals);
    }
    async deleteEvent(eventId) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        await postgres_1.pg.query("UPDATE appointments SET status='cancelled', updated_at=NOW() WHERE id=$1", [eventId]);
    }
    async getAvailableSlots(date, duration) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const base = new Date(day + 'T00:00:00');
        const open = new Date(base);
        open.setHours(9, 0, 0, 0);
        const close = new Date(base);
        close.setHours(18, 0, 0, 0);
        const q = await postgres_1.pg.query("SELECT scheduled_date, duration FROM appointments WHERE user_id=$1 AND scheduled_date::date=$2 AND status IN ('pending','confirmed')", [this.userId, day]);
        const busy = q.rows.map(r => ({ start: new Date(r.scheduled_date), end: new Date(new Date(r.scheduled_date).getTime() + Number(r.duration) * 60000) }));
        const slots = [];
        const step = 30;
        for (let t = open.getTime(); t + duration * 60000 <= close.getTime(); t += step * 60000) {
            const s = new Date(t);
            const e = new Date(t + duration * 60000);
            const conflict = busy.some(b => s < b.end && e > b.start);
            if (!conflict)
                slots.push({ start: s, end: e });
        }
        return slots;
    }
}
function getCalendarService(userId) { return new DefaultCalendarService(userId); }
async function validateAppointment(scheduledDate, duration) {
    const day = scheduledDate.getDay();
    if (day === 0 || day === 6)
        return false;
    const start = new Date(scheduledDate.getTime());
    const end = new Date(scheduledDate.getTime() + duration * 60000);
    const open = new Date(scheduledDate);
    open.setHours(9, 0, 0, 0);
    const close = new Date(scheduledDate);
    close.setHours(18, 0, 0, 0);
    if (start < open)
        return false;
    if (end > close)
        return false;
    return true;
}
