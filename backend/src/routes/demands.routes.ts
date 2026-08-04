import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { HttpError } from '../utils/http-error.js'

export const demandsRouter = Router()

demandsRouter.use(authenticate)

const demandStatusSchema = z.enum(['REQUESTED', 'IN_PROGRESS', 'RESOLVED'])
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)
const optionalQueryString = z.preprocess(emptyToUndefined, z.string().optional())
const optionalBodyString = z.string().optional().nullable()

const demandPayloadSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(3),
  status: demandStatusSchema.default('REQUESTED'),
  requesterName: z.string().trim().min(3),
  requesterPhone: z.string().trim().min(8),
  requesterAddress: z.string().trim().min(5),
  requesterCity: optionalBodyString,
  requesterNeighborhood: optionalBodyString,
  responsibleUserId: optionalBodyString,
  historyNote: optionalBodyString,
})

const demandQuerySchema = z.object({
  search: optionalQueryString,
  status: z.preprocess(emptyToUndefined, demandStatusSchema.optional()),
  responsibleUserId: optionalQueryString,
  city: optionalQueryString,
  neighborhood: optionalQueryString,
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(25)),
})

const demandInclude = {
  responsibleUser: true,
  createdByUser: true,
  history: {
    include: {
      updatedByUser: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
} as const

type CabinetDemandWithRelations = Prisma.CabinetDemandGetPayload<{
  include: typeof demandInclude
}>

function serializeDemand(demand: CabinetDemandWithRelations) {
  return {
    id: demand.id,
    title: demand.title,
    description: demand.description,
    status: demand.status,
    requesterName: demand.requesterName,
    requesterPhone: demand.requesterPhone,
    requesterAddress: demand.requesterAddress,
    requesterCity: demand.requesterCity,
    requesterNeighborhood: demand.requesterNeighborhood,
    responsibleUserId: demand.responsibleUserId,
    responsibleUserName: demand.responsibleUser?.name ?? null,
    createdByUserId: demand.createdByUserId,
    createdByUserName: demand.createdByUser.name,
    resolvedAt: demand.resolvedAt,
    createdAt: demand.createdAt,
    updatedAt: demand.updatedAt,
    history: demand.history.map((item) => ({
      id: item.id,
      previousStatus: item.previousStatus,
      nextStatus: item.nextStatus,
      note: item.note,
      updatedByUserName: item.updatedByUser.name,
      createdAt: item.createdAt,
    })),
  }
}

function resolvedAtFor(status: z.infer<typeof demandStatusSchema>, existingResolvedAt?: Date | null) {
  if (status === 'RESOLVED') {
    return existingResolvedAt ?? new Date()
  }

  return null
}

demandsRouter.get(
  '/responsibles',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (_request, response) => {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
      },
    })

    response.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role.name,
      })),
    })
  }),
)

demandsRouter.get(
  '/',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const filters = demandQuerySchema.parse(request.query)
    const where = {
      AND: [
        filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: 'insensitive' as const } },
                { description: { contains: filters.search, mode: 'insensitive' as const } },
                { requesterName: { contains: filters.search, mode: 'insensitive' as const } },
                { requesterPhone: { contains: filters.search, mode: 'insensitive' as const } },
              ],
            }
          : {},
        filters.status ? { status: filters.status } : {},
        filters.responsibleUserId ? { responsibleUserId: filters.responsibleUserId } : {},
        filters.city ? { requesterCity: filters.city } : {},
        filters.neighborhood ? { requesterNeighborhood: filters.neighborhood } : {},
      ],
    }
    const skip = (filters.page - 1) * filters.limit
    const [demands, total, metrics] = await Promise.all([
      prisma.cabinetDemand.findMany({
        where,
        include: demandInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: filters.limit,
      }),
      prisma.cabinetDemand.count({ where }),
      prisma.cabinetDemand.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ])

    response.json({
      demands: demands.map(serializeDemand),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.max(Math.ceil(total / filters.limit), 1),
      metrics: {
        requested: metrics.find((item) => item.status === 'REQUESTED')?._count._all ?? 0,
        inProgress: metrics.find((item) => item.status === 'IN_PROGRESS')?._count._all ?? 0,
        resolved: metrics.find((item) => item.status === 'RESOLVED')?._count._all ?? 0,
      },
    })
  }),
)

demandsRouter.post(
  '/',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const payload = demandPayloadSchema.parse(request.body)
    const currentUser = request.user!
    const responsibleUserId = payload.responsibleUserId || currentUser.id

    const demand = await prisma.$transaction(async (transaction) => {
      const created = await transaction.cabinetDemand.create({
        data: {
          title: payload.title,
          description: payload.description,
          status: payload.status,
          requesterName: payload.requesterName,
          requesterPhone: payload.requesterPhone,
          requesterAddress: payload.requesterAddress,
          requesterCity: payload.requesterCity?.trim() || null,
          requesterNeighborhood: payload.requesterNeighborhood?.trim() || null,
          responsibleUserId,
          createdByUserId: currentUser.id,
          resolvedAt: resolvedAtFor(payload.status),
        },
        include: demandInclude,
      })

      await transaction.cabinetDemandHistory.create({
        data: {
          demandId: created.id,
          previousStatus: null,
          nextStatus: payload.status,
          note: payload.historyNote?.trim() || 'Demanda registrada.',
          updatedByUserId: currentUser.id,
        },
      })

      return transaction.cabinetDemand.findUniqueOrThrow({
        where: { id: created.id },
        include: demandInclude,
      })
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'CREATE',
      entityType: 'cabinet_demand',
      entityId: demand.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: serializeDemand(demand),
    })

    response.status(201).json({ demand: serializeDemand(demand) })
  }),
)

demandsRouter.patch(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const demandId = String(request.params.id)
    const payload = demandPayloadSchema.partial().parse(request.body)
    const currentUser = request.user!
    const existing = await prisma.cabinetDemand.findUnique({
      where: { id: demandId },
      include: demandInclude,
    })

    if (!existing) {
      throw new HttpError(404, 'Demanda nao encontrada.')
    }

    const nextStatus = payload.status ?? existing.status
    const statusChanged = nextStatus !== existing.status

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.cabinetDemand.update({
        where: { id: existing.id },
        data: {
          ...(payload.title !== undefined ? { title: payload.title } : {}),
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.requesterName !== undefined ? { requesterName: payload.requesterName } : {}),
          ...(payload.requesterPhone !== undefined ? { requesterPhone: payload.requesterPhone } : {}),
          ...(payload.requesterAddress !== undefined ? { requesterAddress: payload.requesterAddress } : {}),
          ...(payload.requesterCity !== undefined ? { requesterCity: payload.requesterCity?.trim() || null } : {}),
          ...(payload.requesterNeighborhood !== undefined ? { requesterNeighborhood: payload.requesterNeighborhood?.trim() || null } : {}),
          ...(payload.responsibleUserId !== undefined ? { responsibleUserId: payload.responsibleUserId || null } : {}),
          status: nextStatus,
          resolvedAt: resolvedAtFor(nextStatus, existing.resolvedAt),
        },
      })

      if (statusChanged || payload.historyNote) {
        await transaction.cabinetDemandHistory.create({
          data: {
            demandId: existing.id,
            previousStatus: statusChanged ? existing.status : null,
            nextStatus,
            note: payload.historyNote?.trim() || null,
            updatedByUserId: currentUser.id,
          },
        })
      }

      return transaction.cabinetDemand.findUniqueOrThrow({
        where: { id: existing.id },
        include: demandInclude,
      })
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'UPDATE',
      entityType: 'cabinet_demand',
      entityId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeDemand(existing),
      nextData: serializeDemand(updated),
    })

    response.json({ demand: serializeDemand(updated) })
  }),
)

demandsRouter.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const demandId = String(request.params.id)
    const existing = await prisma.cabinetDemand.findUnique({
      where: { id: demandId },
      include: demandInclude,
    })

    if (!existing) {
      throw new HttpError(404, 'Demanda nao encontrada.')
    }

    await prisma.cabinetDemand.delete({
      where: { id: existing.id },
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'DELETE',
      entityType: 'cabinet_demand',
      entityId: existing.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeDemand(existing),
    })

    response.status(204).send()
  }),
)
