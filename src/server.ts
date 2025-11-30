import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { clientLimiter, supportLimiter, adminLimiter } from './middlewares/rate'
import { env } from './config/env'
import { migrate } from './config/postgres'
import { connectMongo } from './config/mongo'
import authRoutes from './routes/auth'
import cvRoutes from './routes/cv'
import usersRoutes from './routes/users'
import curriculaRoutes from './routes/curricula'
import meiRoutes from './routes/mei'
import appointmentsRoutes from './routes/appointments'
import paymentsRoutes from './routes/payments'
import dashboardRoutes from './routes/dashboard'
import reportsRoutes from './routes/reports'
import notificationsRoutes from './routes/notifications'
import supportRoutes from './routes/support'
import adminRoutes from './routes/admin'
import healthRoutes from './routes/health'

async function start() {
  const app = express()
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(express.json())
  app.use(express.static(process.cwd()))
  app.get('/health', (req, res) => res.json({ ok: true }))
  app.use('/api/health', healthRoutes)
  app.use('/api/auth', clientLimiter, authRoutes)
  app.use('/api/cv', clientLimiter, cvRoutes)
  app.use('/api/users', clientLimiter, usersRoutes)
  app.use('/api/curricula', clientLimiter, curriculaRoutes)
  app.use('/api/mei', clientLimiter, meiRoutes)
  app.use('/api/appointments', clientLimiter, appointmentsRoutes)
  app.use('/api/payments', clientLimiter, paymentsRoutes)
  app.use('/api/dashboard', clientLimiter, dashboardRoutes)
  app.use('/api/reports', clientLimiter, reportsRoutes)
  app.use('/api/notifications', clientLimiter, notificationsRoutes)
  app.use('/api/support', supportLimiter, supportRoutes)
  app.use('/api/admin', adminLimiter, adminRoutes)
  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}/`)
  })
  setImmediate(async () => {
    try { await migrate() } catch {}
    try { await connectMongo() } catch {}
  })
}

start()
