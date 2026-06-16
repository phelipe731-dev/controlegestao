import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { ensureUniqueUserFields } from '../utils/conflicts.js'
import { HttpError } from '../utils/http-error.js'
import { leaderScope } from '../utils/scopes.js'
import { leaderListInclude, serializeLeader } from '../utils/serializers.js'
import { normalizeEmail, normalizeOptionalDigits, normalizeText } from '../utils/normalizers.js'

export const leadersRouter = Router()

leadersRouter.use(authenticate)

const statusSchema = z.enum(['ACTIVE', 'INACTIVE'])

const leaderCreateSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().min(11),
  phone: z.string().optional().nullable(),
  email: z.string().email(),
  fullAddress: z.string().min(3),
  city: z.string().min(2),
  neighborhood: z.string().min(2),
  supervisorId: z.string().optional().nullable(),
  status: statusSchema.default('ACTIVE'),
  password: z.string().min(8),
})

const leaderUpdateSchema = leaderCreateSchema.extend({
  password: z.string().min(8).optional(),
})

function ensureLeaderWritePermission(role: string, canCreateLeaders: boolean) {
  if (role === 'ADMIN') {
    return
  }

  if (role === 'SUPERVISOR' && canCreateLeaders) {
    return
  }

  throw new HttpError(403, 'Voce nao possui permissao para gerenciar lideres.')
}

leadersRouter.get(
  '/',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const user = request.user!
    const leaders = await prisma.leader.findMany({
      where: leaderScope(user),
      include: leaderListInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })

    const createdCounts = await prisma.supporter.groupBy({
      by: ['createdByUserId'],
      where: {
        createdByUserId: {
          in: leaders.map((leader) => leader.userId),
        },
      },
      _count: {
        _all: true,
      },
    })

    const creationMap = new Map(createdCounts.map((item) => [item.createdByUserId, item._count._all]))

    response.json({
      leaders: leaders.map((leader) => serializeLeader(leader, creationMap.get(leader.userId) ?? 0)),
    })
  }),
)

leadersRouter.get(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const leaderId = String(request.params.id)
    const leader = await prisma.leader.findFirst({
      where: {
        AND: [{ id: leaderId }, leaderScope(request.user!)],
      },
      include: leaderListInclude,
    })

    if (!leader) {
      throw new HttpError(404, 'Lider nao encontrado.')
    }

    const createdCount = await prisma.supporter.count({
      where: {
        createdByUserId: leader.userId,
      },
    })

    response.json({
      leader: serializeLeader(leader, createdCount),
    })
  }),
)

leadersRouter.post(
  '/',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    ensureLeaderWritePermission(currentUser.role.name, currentUser.supervisorProfile?.canCreateLeaders ?? false)

    const payload = leaderCreateSchema.parse(request.body)
    const email = normalizeEmail(payload.email)
    const cpf = payload.cpf.replace(/\D/g, '')
    const phoneNormalized = normalizeOptionalDigits(payload.phone)

    await ensureUniqueUserFields({
      email,
      cpf,
      phoneNormalized,
    })

    const leaderRole = await prisma.role.findUnique({
      where: { name: 'LEADER' },
    })

    if (!leaderRole) {
      throw new HttpError(500, 'Perfil de lider nao configurado.')
    }

    let supervisorId = payload.supervisorId ?? null

    if (currentUser.role.name === 'SUPERVISOR') {
      if (!currentUser.supervisorProfile) {
        throw new HttpError(403, 'Supervisor sem perfil valido.')
      }

      if (supervisorId && supervisorId !== currentUser.supervisorProfile.id) {
        throw new HttpError(403, 'Supervisor so pode vincular lideres a si proprio.')
      }

      supervisorId = currentUser.supervisorProfile.id
    }

    const passwordHash = await bcrypt.hash(payload.password, 10)

    const leader = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          roleId: leaderRole.id,
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

      return transaction.leader.create({
        data: {
          userId: user.id,
          supervisorId,
        },
        include: leaderListInclude,
      })
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'CREATE',
      entityType: 'leader',
      entityId: leader.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: serializeLeader(leader, 0),
    })

    response.status(201).json({
      leader: serializeLeader(leader, 0),
    })
  }),
)

leadersRouter.put(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const leaderId = String(request.params.id)
    ensureLeaderWritePermission(currentUser.role.name, currentUser.supervisorProfile?.canCreateLeaders ?? false)

    const existing = await prisma.leader.findFirst({
      where: {
        AND: [{ id: leaderId }, leaderScope(currentUser)],
      },
      include: leaderListInclude,
    })

    if (!existing) {
      throw new HttpError(404, 'Lider nao encontrado.')
    }

    const payload = leaderUpdateSchema.parse(request.body)
    const email = normalizeEmail(payload.email)
    const cpf = payload.cpf.replace(/\D/g, '')
    const phoneNormalized = normalizeOptionalDigits(payload.phone)

    await ensureUniqueUserFields({
      email,
      cpf,
      phoneNormalized,
      excludeUserId: existing.userId,
    })

    let supervisorId = payload.supervisorId ?? existing.supervisorId

    if (currentUser.role.name === 'SUPERVISOR') {
      if (supervisorId && supervisorId !== currentUser.supervisorProfile?.id) {
        throw new HttpError(403, 'Supervisor so pode manter lideres sob sua responsabilidade.')
      }

      supervisorId = currentUser.supervisorProfile?.id ?? null
    }

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

      return transaction.leader.update({
        where: { id: existing.id },
        data: {
          supervisorId,
        },
        include: leaderListInclude,
      })
    })

    const createdCount = await prisma.supporter.count({
      where: {
        createdByUserId: updated.userId,
      },
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'UPDATE',
      entityType: 'leader',
      entityId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeLeader(existing),
      nextData: serializeLeader(updated, createdCount),
    })

    response.json({
      leader: serializeLeader(updated, createdCount),
    })
  }),
)

leadersRouter.delete(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const leaderId = String(request.params.id)
    ensureLeaderWritePermission(currentUser.role.name, currentUser.supervisorProfile?.canCreateLeaders ?? false)

    const leader = await prisma.leader.findFirst({
      where: {
        AND: [{ id: leaderId }, leaderScope(currentUser)],
      },
      include: leaderListInclude,
    })

    if (!leader) {
      throw new HttpError(404, 'Lider nao encontrado.')
    }

    const [assignedSupporters, createdSupporters] = await Promise.all([
      prisma.supporter.count({ where: { leaderId: leader.id } }),
      prisma.supporter.count({ where: { createdByUserId: leader.userId } }),
    ])

    if (assignedSupporters > 0 || createdSupporters > 0) {
      throw new HttpError(409, 'Nao e possivel excluir um lider com apoiadores vinculados ou historico de cadastro.')
    }

    await prisma.$transaction([
      prisma.leader.delete({ where: { id: leader.id } }),
      prisma.user.delete({ where: { id: leader.userId } }),
    ])

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'DELETE',
      entityType: 'leader',
      entityId: leader.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeLeader(leader),
    })

    response.status(204).send()
  }),
)
