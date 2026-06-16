import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { HttpError } from '../utils/http-error.js'

export const eventsRouter = Router()

eventsRouter.use(authenticate)

const eventPayloadSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  eventDate: z.string().min(10),
  startTimeLabel: z.string().min(4),
  endTimeLabel: z.string().min(4),
  location: z.string().min(3),
  city: z.string().min(2),
  neighborhood: z.string().optional().nullable(),
  electoralZone: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive(),
  expectedAudience: z.coerce.number().int().nonnegative(),
  notifyAllBase: z.boolean().default(false),
  format: z.enum(['PRESENTIAL', 'ONLINE', 'HYBRID']),
  status: z.enum(['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).default('DRAFT'),
})

eventsRouter.get(
  '/',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (_request, response) => {
    const events = await prisma.campaignEvent.findMany({
      orderBy: [{ eventDate: 'asc' }, { startTimeLabel: 'asc' }],
    })

    const supporterCount = await prisma.supporter.count()

    response.json({
      metrics: {
        total: events.length,
        confirmed: events.filter((event) => event.status === 'CONFIRMED').length,
        notifyAllBase: events.filter((event) => event.notifyAllBase).length,
        baseReach: supporterCount,
      },
      events: events.map((event) => ({
        ...event,
        occupancyRate: event.capacity > 0 ? Math.round((event.expectedAudience / event.capacity) * 100) : 0,
      })),
    })
  }),
)

eventsRouter.post(
  '/',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const payload = eventPayloadSchema.parse(request.body)
    const currentUser = request.user!

    const event = await prisma.campaignEvent.create({
      data: {
        ...payload,
        description: payload.description || null,
        neighborhood: payload.neighborhood || null,
        electoralZone: payload.electoralZone || null,
        eventDate: new Date(payload.eventDate),
        createdByUserId: currentUser.id,
      },
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'CREATE',
      entityType: 'event',
      entityId: event.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: event,
    })

    response.status(201).json({ event })
  }),
)

eventsRouter.patch(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const eventId = String(request.params.id)
    const payload = eventPayloadSchema.partial().parse(request.body)
    const existing = await prisma.campaignEvent.findUnique({
      where: { id: eventId },
    })

    if (!existing) {
      throw new HttpError(404, 'Evento nao encontrado.')
    }

    const updated = await prisma.campaignEvent.update({
      where: { id: eventId },
      data: {
        ...payload,
        ...(payload.eventDate ? { eventDate: new Date(payload.eventDate) } : {}),
      },
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'UPDATE',
      entityType: 'event',
      entityId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: existing,
      nextData: updated,
    })

    response.json({ event: updated })
  }),
)
