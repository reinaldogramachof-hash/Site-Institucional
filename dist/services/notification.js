"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationService = getNotificationService;
const postgres_1 = require("../config/postgres");
const env_1 = require("../config/env");
const events_1 = require("./events");
class DefaultNotificationService {
    async sendToUser(userId, n) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const type = n.type || 'info';
        const rs = n.related_service || null;
        const rid = n.related_id || null;
        const ins = await postgres_1.pg.query('INSERT INTO notifications (user_id, title, message, type, related_service, related_id, is_read) VALUES ($1,$2,$3,$4,$5,$6,false)', [userId, n.title, n.message, type, rs, rid]);
        try {
            events_1.notificationEvents.emit(`user:${userId}`, { id: ins.rows?.[0]?.id, user_id: userId, title: n.title, message: n.message, type, related_service: rs, related_id: rid, is_read: false, created_at: new Date().toISOString() });
        }
        catch { }
    }
    async sendToAdmins(n) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const type = n.type || 'info';
        const rs = n.related_service || null;
        const rid = n.related_id || null;
        const res = await postgres_1.pg.query('INSERT INTO notifications (user_id, title, message, type, related_service, related_id, is_read) SELECT id, $1, $2, $3, $4, $5, false FROM users WHERE user_type=\'admin\'', [n.title, n.message, type, rs, rid]);
        try {
            events_1.notificationEvents.emit('admins', { title: n.title, message: n.message, type });
        }
        catch { }
    }
    async markAsRead(notificationId) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        await postgres_1.pg.query('UPDATE notifications SET is_read=true, updated_at=NOW() WHERE id=$1', [notificationId]);
    }
    async getUserNotifications(userId, filters) {
        if (!env_1.env.PG_CONNECTION_STRING)
            throw new Error('db_unavailable');
        const conditions = ['user_id = $1'];
        const values = [userId];
        if (typeof filters.is_read === 'boolean') {
            values.push(filters.is_read);
            conditions.push(`is_read = $${values.length}`);
        }
        if (filters.type) {
            values.push(filters.type);
            conditions.push(`type = $${values.length}`);
        }
        if (filters.since) {
            values.push(filters.since);
            conditions.push(`created_at >= $${values.length}`);
        }
        if (filters.until) {
            values.push(filters.until);
            conditions.push(`created_at <= $${values.length}`);
        }
        const where = `WHERE ${conditions.join(' AND ')}`;
        const limit = Math.min(100, Math.max(1, filters.limit || 20));
        const offset = Math.max(0, filters.offset || 0);
        const q = await postgres_1.pg.query(`SELECT id, user_id, title, message, type, related_service, related_id, is_read, created_at FROM notifications ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]);
        return q.rows.map(r => ({
            id: String(r.id),
            user_id: String(r.user_id),
            title: String(r.title),
            message: String(r.message),
            type: r.type ? String(r.type) : null,
            related_service: r.related_service ? String(r.related_service) : null,
            related_id: r.related_id ? String(r.related_id) : null,
            is_read: Boolean(r.is_read),
            created_at: new Date(r.created_at).toISOString()
        }));
    }
}
function getNotificationService() { return new DefaultNotificationService(); }
