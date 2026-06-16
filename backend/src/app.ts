import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { notFoundHandler } from './middleware/not-found.js'
import { accountRouter } from './routes/account.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { dashboardRouter } from './routes/dashboard.routes.js'
import { eventsRouter } from './routes/events.routes.js'
import { leadersRouter } from './routes/leaders.routes.js'
import { communicationsRouter } from './routes/communications.routes.js'
import { reportsRouter } from './routes/reports.routes.js'
import { settingsRouter } from './routes/settings.routes.js'
import { supervisorsRouter } from './routes/supervisors.routes.js'
import { supportersRouter } from './routes/supporters.routes.js'
import { territoriesRouter } from './routes/territories.routes.js'

export const app = express()

app.set('trust proxy', true)

app.use(
  cors({
    origin: env.FRONTEND_URL,
  }),
)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/communications', communicationsRouter)
app.use('/api/events', eventsRouter)
app.use('/api/leaders', leadersRouter)
app.use('/api/supervisors', supervisorsRouter)
app.use('/api/supporters', supportersRouter)
app.use('/api/territories', territoriesRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/account', accountRouter)

app.use(notFoundHandler)
app.use(errorHandler)
