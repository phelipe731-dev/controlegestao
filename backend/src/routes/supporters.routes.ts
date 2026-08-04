import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { findSupporterConflict } from '../utils/conflicts.js'
import { HttpError } from '../utils/http-error.js'
import { normalizeOptionalDigits, normalizeText } from '../utils/normalizers.js'
import { serializeSupporter, supporterListInclude } from '../utils/serializers.js'
import { buildSupporterWhere } from '../utils/supporter-filters.js'
import { supporterScope } from '../utils/scopes.js'

export const supportersRouter = Router()

supportersRouter.use(authenticate)

const consentSourceSchema = z.enum(['WEB_FORM', 'PRESENTIAL', 'EVENT', 'WHATSAPP', 'PHONE', 'OTHER'])
const supporterStatusSchema = z.enum(['ACTIVE', 'ARCHIVED', 'ANONYMIZED'])
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)
const optionalQueryString = z.preprocess(emptyToUndefined, z.string().optional())
const optionalBodyString = z.string().optional().nullable()

const supporterPayloadSchema = z.object({
  fullName: z.string().min(3),
  fullAddress: z.string().min(5),
  cpf: optionalBodyString,
  phone: z.string().min(8),
  birthDate: z.string().min(10),
  postalCode: optionalBodyString,
  street: optionalBodyString,
  number: optionalBodyString,
  complement: optionalBodyString,
  neighborhood: optionalBodyString,
  city: optionalBodyString,
  state: optionalBodyString,
  voterRegistration: optionalBodyString,
  electoralZone: optionalBodyString,
  electoralSection: optionalBodyString,
  leaderId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  consentAccepted: z.boolean(),
  consentSource: consentSourceSchema,
  status: supporterStatusSchema.default('ACTIVE'),
})

const supporterQuerySchema = z.object({
  search: optionalQueryString,
  leaderId: optionalQueryString,
  city: optionalQueryString,
  neighborhood: optionalQueryString,
  electoralZone: optionalQueryString,
  status: z.preprocess(emptyToUndefined, supporterStatusSchema.optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(1)),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(25)),
})

const transferSchema = z.object({
  leaderId: z.string().min(1),
})

async function resolveLeaderId(currentUser: NonNullable<Express.Request['user']>, inputLeaderId?: string | null) {
  if (currentUser.role.name === 'LEADER') {
    if (!currentUser.leaderProfile) {
      throw new HttpError(403, 'Lider sem perfil vinculado.')
    }

    return currentUser.leaderProfile.id
  }

  if (currentUser.role.name === 'ADMIN') {
    if (!inputLeaderId) {
      throw new HttpError(400, 'Selecione o lider responsavel.')
    }

    return inputLeaderId
  }

  throw new HttpError(403, 'Somente administradores e lideres podem cadastrar apoiadores.')
}

function conflictMessage(conflict: Awaited<ReturnType<typeof findSupporterConflict>>, leaderId: string) {
  if (!conflict) {
    return null
  }

  if (conflict.supporter.leaderId !== leaderId) {
    return {
      message: 'Este apoiador ja esta cadastrado e vinculado a outro lider.',
      details: {
        conflictType: conflict.type,
        leaderName: conflict.supporter.leader.user.name,
      },
    }
  }

  if (conflict.type === 'cpf') {
    return { message: 'Ja existe um apoiador cadastrado com este CPF.' }
  }

  if (conflict.type === 'voterRegistration') {
    return { message: 'Ja existe um apoiador cadastrado com este titulo de eleitor.' }
  }

  return { message: 'Ja existe um apoiador cadastrado com este telefone.' }
}

function makeTechnicalIdentifier(prefix: string) {
  return `${prefix}-${randomUUID()}`
}

function normalizeManualDigits(value?: string | null, autoPrefix?: string) {
  const trimmed = value?.trim()
  if (!trimmed || (autoPrefix && trimmed.startsWith(`${autoPrefix}-`))) {
    return null
  }

  const digits = trimmed.replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

function supporterAddress(payload: z.infer<typeof supporterPayloadSchema>) {
  const fullAddress = payload.fullAddress.trim()
  const state = (payload.state?.trim() || 'SP').slice(0, 2).toUpperCase()

  return {
    fullAddress,
    postalCode: payload.postalCode?.trim() || '00000000',
    street: payload.street?.trim() || fullAddress,
    number: payload.number?.trim() || 'S/N',
    complement: payload.complement?.trim() || null,
    neighborhood: payload.neighborhood?.trim() || 'Nao informado',
    city: payload.city?.trim() || 'Nao informada',
    state,
  }
}

supportersRouter.get(
  '/',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const filters = supporterQuerySchema.parse(request.query)
    const where = buildSupporterWhere(request.user!, filters)
    const skip = (filters.page - 1) * filters.limit
    const [supporters, total] = await Promise.all([
      prisma.supporter.findMany({
        where,
        include: supporterListInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: filters.limit,
      }),
      prisma.supporter.count({ where }),
    ])

    response.json({
      supporters: supporters.map(serializeSupporter),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.max(Math.ceil(total / filters.limit), 1),
    })
  }),
)

supportersRouter.get(
  '/:id',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const supporterId = String(request.params.id)
    const supporter = await prisma.supporter.findFirst({
      where: {
        AND: [{ id: supporterId }, supporterScope(request.user!)],
      },
      include: supporterListInclude,
    })

    if (!supporter) {
      throw new HttpError(404, 'Apoiador nao encontrado.')
    }

    response.json({
      supporter: serializeSupporter(supporter),
    })
  }),
)

supportersRouter.post(
  '/',
  authorize('ADMIN', 'LEADER'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const payload = supporterPayloadSchema.parse(request.body)

    if (!payload.consentAccepted) {
      throw new HttpError(400, 'O consentimento LGPD e obrigatorio para concluir o cadastro.')
    }

    const leaderId = await resolveLeaderId(currentUser, payload.leaderId)
    const leader = await prisma.leader.findUnique({
      where: { id: leaderId },
    })

    if (!leader) {
      throw new HttpError(404, 'Lider responsavel nao encontrado.')
    }

    const cpf = normalizeManualDigits(payload.cpf, 'AUTOCPF')
    const voterRegistration = normalizeManualDigits(payload.voterRegistration, 'AUTOTIT')
    const phoneNormalized = normalizeOptionalDigits(payload.phone)

    if (!phoneNormalized) {
      throw new HttpError(400, 'Informe o telefone do apoiador.')
    }

    const conflict = await findSupporterConflict({
      cpf,
      phoneNormalized,
      voterRegistration,
    })

    const message = conflictMessage(conflict, leaderId)
    if (message) {
      throw new HttpError(409, message.message, message.details)
    }

    const address = supporterAddress(payload)

    const supporter = await prisma.$transaction(async (transaction) => {
      const created = await transaction.supporter.create({
        data: {
          fullName: normalizeText(payload.fullName),
          cpf: cpf ?? makeTechnicalIdentifier('AUTOCPF'),
          phone: payload.phone?.trim() || null,
          phoneNormalized,
          birthDate: new Date(payload.birthDate),
          fullAddress: address.fullAddress,
          postalCode: address.postalCode,
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          voterRegistration: voterRegistration ?? makeTechnicalIdentifier('AUTOTIT'),
          electoralZone: payload.electoralZone?.trim() || 'Nao informado',
          electoralSection: payload.electoralSection?.trim() || 'Nao informada',
          leaderId,
          notes: payload.notes?.trim() || null,
          consentAccepted: payload.consentAccepted,
          consentSource: payload.consentSource,
          consentAcceptedAt: new Date(),
          status: payload.status,
          createdByUserId: currentUser.id,
        },
        include: supporterListInclude,
      })

      await transaction.supporterConsent.create({
        data: {
          supporterId: created.id,
          accepted: payload.consentAccepted,
          source: payload.consentSource,
          recordedByUserId: currentUser.id,
          acceptedAt: created.consentAcceptedAt,
          ipAddress: request.ip,
          consentTextVersion: 'v1',
        },
      })

      return created
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'CREATE',
      entityType: 'supporter',
      entityId: supporter.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: serializeSupporter(supporter),
    })

    response.status(201).json({
      supporter: serializeSupporter(supporter),
    })
  }),
)

supportersRouter.put(
  '/:id',
  authorize('ADMIN', 'LEADER'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const supporterId = String(request.params.id)
    const existing = await prisma.supporter.findFirst({
      where: {
        AND: [{ id: supporterId }, supporterScope(currentUser)],
      },
      include: supporterListInclude,
    })

    if (!existing) {
      throw new HttpError(404, 'Apoiador nao encontrado.')
    }

    const payload = supporterPayloadSchema.parse(request.body)

    if (!payload.consentAccepted) {
      throw new HttpError(400, 'O consentimento LGPD e obrigatorio para manter o cadastro ativo.')
    }

    const leaderId = currentUser.role.name === 'LEADER' ? existing.leaderId : existing.leaderId

    const cpf = normalizeManualDigits(payload.cpf, 'AUTOCPF')
    const voterRegistration = normalizeManualDigits(payload.voterRegistration, 'AUTOTIT')
    const phoneNormalized = normalizeOptionalDigits(payload.phone)

    if (!phoneNormalized) {
      throw new HttpError(400, 'Informe o telefone do apoiador.')
    }

    const conflict = await findSupporterConflict({
      cpf,
      phoneNormalized,
      voterRegistration,
      excludeSupporterId: existing.id,
    })

    const message = conflictMessage(conflict, leaderId)
    if (message) {
      throw new HttpError(409, message.message, message.details)
    }

    const address = supporterAddress(payload)

    const updated = await prisma.$transaction(async (transaction) => {
      const supporter = await transaction.supporter.update({
        where: { id: existing.id },
        data: {
          fullName: normalizeText(payload.fullName),
          cpf: cpf ?? existing.cpf,
          phone: payload.phone?.trim() || null,
          phoneNormalized,
          birthDate: new Date(payload.birthDate),
          fullAddress: address.fullAddress,
          postalCode: address.postalCode,
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          voterRegistration: voterRegistration ?? existing.voterRegistration,
          electoralZone: payload.electoralZone?.trim() || existing.electoralZone,
          electoralSection: payload.electoralSection?.trim() || existing.electoralSection,
          notes: payload.notes?.trim() || null,
          consentAccepted: payload.consentAccepted,
          consentSource: payload.consentSource,
          consentAcceptedAt: new Date(),
          status: currentUser.role.name === 'ADMIN' ? payload.status : existing.status,
          updatedByUserId: currentUser.id,
        },
        include: supporterListInclude,
      })

      await transaction.supporterConsent.create({
        data: {
          supporterId: supporter.id,
          accepted: payload.consentAccepted,
          source: payload.consentSource,
          recordedByUserId: currentUser.id,
          acceptedAt: supporter.consentAcceptedAt,
          ipAddress: request.ip,
          consentTextVersion: 'v1',
        },
      })

      return supporter
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'UPDATE',
      entityType: 'supporter',
      entityId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeSupporter(existing),
      nextData: serializeSupporter(updated),
    })

    response.json({
      supporter: serializeSupporter(updated),
    })
  }),
)

supportersRouter.post(
  '/:id/transfer',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const supporterId = String(request.params.id)
    const payload = transferSchema.parse(request.body)

    const [supporter, newLeader] = await Promise.all([
      prisma.supporter.findUnique({
        where: { id: supporterId },
        include: supporterListInclude,
      }),
      prisma.leader.findUnique({
        where: { id: payload.leaderId },
        include: {
          user: true,
          supervisor: {
            include: {
              user: true,
            },
          },
        },
      }),
    ])

    if (!supporter) {
      throw new HttpError(404, 'Apoiador nao encontrado.')
    }

    if (!newLeader) {
      throw new HttpError(404, 'Novo lider nao encontrado.')
    }

    const updated = await prisma.supporter.update({
      where: { id: supporter.id },
      data: {
        leaderId: newLeader.id,
        updatedByUserId: currentUser.id,
      },
      include: supporterListInclude,
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'TRANSFER',
      entityType: 'supporter',
      entityId: updated.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: {
        leaderId: supporter.leaderId,
        leaderName: supporter.leader.user.name,
      },
      nextData: {
        leaderId: newLeader.id,
        leaderName: newLeader.user.name,
      },
    })

    response.json({
      supporter: serializeSupporter(updated),
    })
  }),
)

supportersRouter.post(
  '/:id/anonymize',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const supporterId = String(request.params.id)
    const supporter = await prisma.supporter.findUnique({
      where: { id: supporterId },
      include: supporterListInclude,
    })

    if (!supporter) {
      throw new HttpError(404, 'Apoiador nao encontrado.')
    }

    const suffix = `${Date.now()}${supporter.id.slice(-4)}`
    const anonymized = await prisma.supporter.update({
      where: { id: supporter.id },
      data: {
        fullName: 'Titular anonimizado',
        cpf: `ANON-${suffix}`,
        phone: null,
        phoneNormalized: null,
        birthDate: new Date('1900-01-01'),
        fullAddress: 'Dado anonimizado',
        postalCode: '00000000',
        street: 'Dado anonimizado',
        number: '0',
        complement: null,
        neighborhood: 'Anonimizado',
        city: 'Anonimizado',
        state: 'AN',
        voterRegistration: `TIT-${suffix}`,
        electoralZone: '0',
        electoralSection: '0',
        notes: 'Registro anonimizado mediante solicitacao do titular.',
        status: 'ANONYMIZED',
        updatedByUserId: currentUser.id,
      },
      include: supporterListInclude,
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'ANONYMIZE',
      entityType: 'supporter',
      entityId: supporter.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeSupporter(supporter),
      nextData: serializeSupporter(anonymized),
    })

    response.json({
      supporter: serializeSupporter(anonymized),
    })
  }),
)

supportersRouter.delete(
  '/:id',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const supporterId = String(request.params.id)
    const supporter = await prisma.supporter.findUnique({
      where: { id: supporterId },
      include: supporterListInclude,
    })

    if (!supporter) {
      throw new HttpError(404, 'Apoiador nao encontrado.')
    }

    await prisma.$transaction([
      prisma.supporterConsent.deleteMany({ where: { supporterId: supporter.id } }),
      prisma.supporter.delete({ where: { id: supporter.id } }),
    ])

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'DELETE',
      entityType: 'supporter',
      entityId: supporter.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeSupporter(supporter),
    })

    response.status(204).send()
  }),
)
