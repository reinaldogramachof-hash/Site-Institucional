import { Router } from 'express'
import { requireAuth } from '../middlewares/auth'
import { pg } from '../config/postgres'
import { env } from '../config/env'

const router = Router()

router.get('/user', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const curriculaCountRes = await pg.query("SELECT COUNT(*)::int AS c FROM curricula WHERE user_id=$1 AND (deleted_at IS NULL)", [uid])
  const upcomingAppointments = await pg.query("SELECT id, service_type, scheduled_date, duration, status FROM appointments WHERE user_id=$1 AND scheduled_date >= NOW() AND status IN ('pending','confirmed') ORDER BY scheduled_date ASC LIMIT 5", [uid])
  const unreadCountRes = await pg.query('SELECT COUNT(*)::int AS c FROM notifications WHERE user_id=$1 AND is_read=false', [uid])
  const unreadNotifications = await pg.query('SELECT id, title, message, type, created_at FROM notifications WHERE user_id=$1 AND is_read=false ORDER BY created_at DESC LIMIT 10', [uid])
  const upcomingDas = await pg.query("SELECT mi.id, mi.reference_month, mi.due_date, mi.amount, mi.status FROM mei_invoices mi JOIN mei_services ms ON mi.mei_service_id=ms.id WHERE ms.user_id=$1 AND mi.due_date >= CURRENT_DATE AND mi.status IN ('pending','overdue') ORDER BY mi.due_date ASC LIMIT 3", [uid])
  const recentNfes = await pg.query("SELECT mn.id, mn.number, mn.value, mn.issue_date, mn.status FROM mei_nfes mn JOIN mei_services ms ON mn.mei_service_id=ms.id WHERE ms.user_id=$1 ORDER BY mn.issue_date DESC LIMIT 5", [uid])
  const recentPayments = await pg.query('SELECT id, amount, currency, status, provider, created_at FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5', [uid])
  return res.json({
    stats: {
      curricula_count: curriculaCountRes.rows[0]?.c || 0,
      upcoming_appointments: upcomingAppointments.rows,
      upcoming_das: upcomingDas.rows,
      unread_notifications_count: unreadCountRes.rows[0]?.c || 0,
      unread_notifications: unreadNotifications.rows
    },
    recent: {
      nfes: recentNfes.rows,
      payments: recentPayments.rows
    }
  })
})

router.get('/admin', requireAuth, async (req, res) => {
  if (!env.PG_CONNECTION_STRING) return res.status(503).json({ error: 'db_unavailable' })
  const uid = (req as any).userId as string
  const roleRes = await pg.query('SELECT user_type FROM users WHERE id=$1', [uid])
  if (!roleRes.rows.length || roleRes.rows[0].user_type !== 'admin') return res.status(403).json({ error: 'forbidden' })
  const totalUsersRes = await pg.query('SELECT COUNT(*)::int AS c FROM users')
  const newUsersRes = await pg.query("SELECT COUNT(*)::int AS c FROM users WHERE created_at >= NOW() - INTERVAL '30 days'")
  const totalCurriculaRes = await pg.query('SELECT COUNT(*)::int AS c FROM curricula')
  const upcomingApptRes = await pg.query("SELECT COUNT(*)::int AS c FROM appointments WHERE scheduled_date >= NOW() AND status IN ('pending','confirmed')")
  const revenue30Res = await pg.query("SELECT COALESCE(SUM(amount),0)::int AS s FROM payments WHERE status IN ('succeeded','approved','paid') AND created_at >= NOW() - INTERVAL '30 days'")
  const churnRes = await pg.query("SELECT SUM(CASE WHEN subscription_status='canceled' THEN 1 ELSE 0 END)::int AS canceled, SUM(CASE WHEN subscription_status='active' THEN 1 ELSE 0 END)::int AS active FROM users")
  const usersByMonth = await pg.query("SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS month, COUNT(*)::int AS count FROM users GROUP BY 1 ORDER BY 1 DESC LIMIT 6")
  const revenueByMonth = await pg.query("SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS month, COALESCE(SUM(amount),0)::int AS amount FROM payments WHERE status IN ('succeeded','approved','paid') GROUP BY 1 ORDER BY 1 DESC LIMIT 6")
  const recentLogs = await pg.query('SELECT id, admin_id, action, resource_type, resource_id, created_at FROM admin_logs ORDER BY created_at DESC LIMIT 20')
  const canceled = churnRes.rows[0]?.canceled || 0
  const active = churnRes.rows[0]?.active || 0
  const churnRate = active + canceled > 0 ? Number((canceled / (active + canceled)).toFixed(4)) : 0
  return res.json({
    metrics: {
      total_users: totalUsersRes.rows[0]?.c || 0,
      new_users_30d: newUsersRes.rows[0]?.c || 0,
      total_curricula: totalCurriculaRes.rows[0]?.c || 0,
      upcoming_appointments: upcomingApptRes.rows[0]?.c || 0,
      revenue_30d_cents: revenue30Res.rows[0]?.s || 0,
      churn_rate: churnRate
    },
    charts: {
      users_by_month: usersByMonth.rows,
      revenue_by_month_cents: revenueByMonth.rows
    },
    recent_logs: recentLogs.rows
  })
})

export default router