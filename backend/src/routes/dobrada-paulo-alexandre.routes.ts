import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { HttpError } from '../utils/http-error.js'
import { normalizeEmail, normalizeOptionalDigits, normalizeText } from '../utils/normalizers.js'

export const dobradaPauloAlexandreRouter = Router()

dobradaPauloAlexandreRouter.use(authenticate)

const statusSchema = z.enum(['ACTIVE', 'INACTIVE'])
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)
const emptyToNull = (value: unknown) => (value === '' ? null : value)
const optionalQueryString = z.preprocess(emptyToUndefined, z.string().optional())
const optionalPayloadString = z.preprocess(emptyToNull, z.string().trim().nullable().optional())

const querySchema = z.object({
  search: optionalQueryString,
  city: optionalQueryString,
  neighborhood: optionalQueryString,
  status: z.preprocess(emptyToUndefined, statusSchema.optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(25)),
})

const payloadSchema = z.object({
  fullName: z.string().trim().min(2),
  cpf: optionalPayloadString,
  phone: optionalPayloadString,
  email: z.preprocess(emptyToNull, z.string().trim().email().nullable().optional()),
  fullAddress: optionalPayloadString,
  city: optionalPayloadString,
  neighborhood: optionalPayloadString,
  source: optionalPayloadString,
  notes: optionalPayloadString,
  status: statusSchema.default('ACTIVE'),
})

const leaderInclude = {
  createdByUser: true,
  updatedByUser: true,
} satisfies Prisma.DobradaPauloAlexandreLeaderInclude

type DobradaLeaderWithRelations = Prisma.DobradaPauloAlexandreLeaderGetPayload<{
  include: typeof leaderInclude
}>

function serializeDobradaLeader(item: DobradaLeaderWithRelations) {
  return {
    id: item.id,
    fullName: item.fullName,
    cpf: item.cpf,
    phone: item.phone,
    email: item.email,
    fullAddress: item.fullAddress,
    city: item.city,
    neighborhood: item.neighborhood,
    source: item.source,
    notes: item.notes,
    status: item.status,
    createdByUserName: item.createdByUser?.name ?? null,
    updatedByUserName: item.updatedByUser?.name ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function buildWhere(filters: z.infer<typeof querySchema>): Prisma.DobradaPauloAlexandreLeaderWhereInput {
  const and: Prisma.DobradaPauloAlexandreLeaderWhereInput[] = []
  const search = filters.search?.trim()
  const digitsSearch = search?.replace(/\D/g, '')

  if (filters.status) {
    and.push({ status: filters.status })
  }

  if (filters.city?.trim()) {
    and.push({ city: { contains: filters.city.trim(), mode: 'insensitive' } })
  }

  if (filters.neighborhood?.trim()) {
    and.push({ neighborhood: { contains: filters.neighborhood.trim(), mode: 'insensitive' } })
  }

  if (search) {
    and.push({
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fullAddress: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { neighborhood: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        ...(digitsSearch
          ? [
              { cpf: { contains: digitsSearch } },
              { phoneNormalized: { contains: digitsSearch } },
            ]
          : []),
      ],
    })
  }

  return and.length > 0 ? { AND: and } : {}
}

function buildData(payload: z.infer<typeof payloadSchema>) {
  const phoneNormalized = normalizeOptionalDigits(payload.phone)

  return {
    fullName: normalizeText(payload.fullName),
    cpf: payload.cpf?.replace(/\D/g, '') || null,
    phone: payload.phone?.trim() || null,
    phoneNormalized,
    email: payload.email ? normalizeEmail(payload.email) : null,
    fullAddress: payload.fullAddress?.trim() || null,
    city: payload.city?.trim() || null,
    neighborhood: payload.neighborhood?.trim() || null,
    source: payload.source?.trim() || null,
    notes: payload.notes?.trim() || null,
    status: payload.status,
  }
}

dobradaPauloAlexandreRouter.get(
  '/leaders',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const filters = querySchema.parse(request.query)
    const where = buildWhere(filters)
    const skip = (filters.page - 1) * filters.limit

    const [leaders, total] = await Promise.all([
      prisma.dobradaPauloAlexandreLeader.findMany({
        where,
        include: leaderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: filters.limit,
      }),
      prisma.dobradaPauloAlexandreLeader.count({ where }),
    ])

    response.json({
      leaders: leaders.map(serializeDobradaLeader),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.max(Math.ceil(total / filters.limit), 1),
    })
  }),
)

dobradaPauloAlexandreRouter.post(
  '/leaders',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const payload = payloadSchema.parse(request.body)
    const leader = await prisma.dobradaPauloAlexandreLeader.create({
      data: {
        ...buildData(payload),
        createdByUserId: request.user!.id,
      },
      include: leaderInclude,
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'CREATE',
      entityType: 'dobrada_paulo_alexandre_leader',
      entityId: leader.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: serializeDobradaLeader(leader),
    })

    response.status(201).json({
      leader: serializeDobradaLeader(leader),
    })
  }),
)

dobradaPauloAlexandreRouter.put(
  '/leaders/:id',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const leaderId = String(request.params.id)
    const existing = await prisma.dobradaPauloAlexandreLeader.findUnique({
      where: { id: leaderId },
      include: leaderInclude,
    })

    if (!existing) {
      throw new HttpError(404, 'Lideranca da dobrada nao encontrada.')
    }

    const payload = payloadSchema.parse(request.body)
    const updated = await prisma.dobradaPauloAlexandreLeader.update({
      where: { id: leaderId },
      data: {
        ...buildData(payload),
        updatedByUserId: request.user!.id,
      },
      include: leaderInclude,
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'UPDATE',
      entityType: 'dobrada_paulo_alexandre_leader',
      entityId: leaderId,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeDobradaLeader(existing),
      nextData: serializeDobradaLeader(updated),
    })

    response.json({
      leader: serializeDobradaLeader(updated),
    })
  }),
)

dobradaPauloAlexandreRouter.delete(
  '/leaders/:id',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const leaderId = String(request.params.id)
    const existing = await prisma.dobradaPauloAlexandreLeader.findUnique({
      where: { id: leaderId },
      include: leaderInclude,
    })

    if (!existing) {
      throw new HttpError(404, 'Lideranca da dobrada nao encontrada.')
    }

    await prisma.dobradaPauloAlexandreLeader.delete({
      where: { id: leaderId },
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'DELETE',
      entityType: 'dobrada_paulo_alexandre_leader',
      entityId: leaderId,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeDobradaLeader(existing),
    })

    response.status(204).send()
  }),
)
