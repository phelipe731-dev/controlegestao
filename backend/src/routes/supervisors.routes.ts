import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { ensureUniqueUserFields } from '../utils/conflicts.js'
import { HttpError } from '../utils/http-error.js'
import { normalizeEmail, normalizeOptionalDigits, normalizeText } from '../utils/normalizers.js'
import { supervisorScope } from '../utils/scopes.js'
import { serializeSupervisor, supervisorListInclude } from '../utils/serializers.js'

export const supervisorsRouter = Router()

supervisorsRouter.use(authenticate)

const statusSchema = z.enum(['ACTIVE', 'INACTIVE'])

const supervisorCreateSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().min(11),
  phone: z.string().optional().nullable(),
  email: z.string().email(),
  fullAddress: z.string().min(3),
  city: z.string().min(2),
  neighborhood: z.string().min(2),
  status: statusSchema.default('ACTIVE'),
  canCreateLeaders: z.boolean().default(false),
  password: z.string().min(8),
})

const supervisorUpdateSchema = supervisorCreateSchema.extend({
  password: z.string().min(8).optional(),
})

supervisorsRouter.get(
  '/',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const supervisors = await prisma.supervisor.findMany({
      where: supervisorScope(request.user!),
      include: supervisorListInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })

    const leaderCounts = await prisma.leader.groupBy({
      by: ['supervisorId'],
      where: {
        supervisorId: {
          in: supervisors.map((supervisor) => supervisor.id),
        },
      },
      _count: {
        _all: true,
      },
    })

    const countsMap = new Map(leaderCounts.map((item) => [item.supervisorId, item._count._all]))

    response.json({
      supervisors: supervisors.map((supervisor) => serializeSupervisor(supervisor, countsMap.get(supervisor.id) ?? 0)),
    })
  }),
)

supervisorsRouter.get(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const supervisorId = String(request.params.id)
    const supervisor = await prisma.supervisor.findFirst({
      where: {
        AND: [{ id: supervisorId }, supervisorScope(request.user!)],
      },
      include: supervisorListInclude,
    })

    if (!supervisor) {
      throw new HttpError(404, 'Supervisor nao encontrado.')
    }

    const leadersCount = await prisma.leader.count({
      where: { supervisorId: supervisor.id },
    })

    response.json({
      supervisor: serializeSupervisor(supervisor, leadersCount),
    })
  }),
)

supervisorsRouter.post(
  '/',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const payload = supervisorCreateSchema.parse(request.body)
    const email = normalizeEmail(payload.email)
    const cpf = payload.cpf.replace(/\D/g, '')
    const phoneNormalized = normalizeOptionalDigits(payload.phone)

    await ensureUniqueUserFields({
      email,
      cpf,
      phoneNormalized,
    })

    const supervisorRole = await prisma.role.findUnique({
      where: { name: 'SUPERVISOR' },
    })

    if (!supervisorRole) {
      throw new HttpError(500, 'Perfil de supervisor nao configurado.')
    }

    const passwordHash = await bcrypt.hash(payload.password, 10)

    const supervisor = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          roleId: supervisorRole.id,
          name: normalizeText(payload.name),
          email,
          cpf,
          phone: payload.phone?.trim() || null,
          phoneNormalized,
          passwordHash,
          status: payload.status,
          fullAddress: payload.fullAddress.trim(),
          city: payload.city.trim(),
          neighborhood: payload.neighborhood.trim(),
        },
      })

      return transaction.supervisor.create({
        data: {
          userId: user.id,
          canCreateLeaders: payload.canCreateLeaders,
        },
        include: supervisorListInclude,
      })
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'CREATE',
      entityType: 'supervisor',
      entityId: supervisor.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: serializeSupervisor(supervisor, 0),
    })

    response.status(201).json({
      supervisor: serializeSupervisor(supervisor, 0),
    })
  }),
)

supervisorsRouter.put(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const supervisorId = String(request.params.id)
    const existing = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: supervisorListInclude,
    })

    if (!existing) {
      throw new HttpError(404, 'Supervisor nao encontrado.')
    }

    const payload = supervisorUpdateSchema.parse(request.body)
    const email = normalizeEmail(payload.email)
    const cpf = payload.cpf.replace(/\D/g, '')
    const phoneNormalized = normalizeOptionalDigits(payload.phone)

    await ensureUniqueUserFields({
      email,
      cpf,
      phoneNormalized,
      excludeUserId: existing.userId,
    })

    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: existing.userId },
        data: {
          name: normalizeText(payload.name),
          email,
          cpf,
          phone: payload.phone?.trim() || null,
          phoneNormalized,
          status: payload.status,
          fullAddress: payload.fullAddress.trim(),
          city: payload.city.trim(),
          neighborhood: payload.neighborhood.trim(),
          ...(payload.password ? { passwordHash: await bcrypt.hash(payload.password, 10) } : {}),
        },
      })

      return transaction.supervisor.update({
        where: { id: existing.id },
        data: {
          canCreateLeaders: payload.canCreateLeaders,
        },
        include: supervisorListInclude,
      })
    })

    const leadersCount = await prisma.leader.count({
      where: { supervisorId: existing.id },
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'UPDATE',
      entityType: 'supervisor',
      entityId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeSupervisor(existing, leadersCount),
      nextData: serializeSupervisor(updated, leadersCount),
    })

    response.json({
      supervisor: serializeSupervisor(updated, leadersCount),
    })
  }),
)

supervisorsRouter.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const supervisorId = String(request.params.id)
    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: supervisorListInclude,
    })

    if (!supervisor) {
      throw new HttpError(404, 'Supervisor nao encontrado.')
    }

    const leadersCount = await prisma.leader.count({
      where: { supervisorId: supervisor.id },
    })

    if (leadersCount > 0) {
      throw new HttpError(409, 'Nao e possivel excluir um supervisor com lideres vinculados.')
    }

    await prisma.$transaction([
      prisma.supervisor.delete({ where: { id: supervisor.id } }),
      prisma.user.delete({ where: { id: supervisor.userId } }),
    ])

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'DELETE',
      entityType: 'supervisor',
      entityId: supervisor.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeSupervisor(supervisor, leadersCount),
    })

    response.status(204).send()
  }),
)
