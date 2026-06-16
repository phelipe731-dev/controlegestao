import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { ensureUniqueUserFields } from '../utils/conflicts.js'
import { HttpError } from '../utils/http-error.js'
import { normalizeEmail, normalizeOptionalDigits, normalizeText } from '../utils/normalizers.js'
import { serializeAuthUser } from '../utils/serializers.js'
import { authUserInclude } from '../types/auth.js'

export const accountRouter = Router()

accountRouter.use(authenticate)

const profileSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  cpf: z.string().min(11),
  phone: z.string().optional().nullable(),
  fullAddress: z.string().min(3).optional().nullable(),
  city: z.string().min(2).optional().nullable(),
  neighborhood: z.string().min(2).optional().nullable(),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
})

accountRouter.get(
  '/me',
  asyncHandler(async (request, response) => {
    response.json({
      user: serializeAuthUser(request.user!),
    })
  }),
)

accountRouter.put(
  '/me',
  asyncHandler(async (request, response) => {
    const payload = profileSchema.parse(request.body)
    const currentUser = request.user!
    const normalizedEmail = normalizeEmail(payload.email)
    const normalizedCpf = payload.cpf.replace(/\D/g, '')
    const phoneNormalized = normalizeOptionalDigits(payload.phone)

    await ensureUniqueUserFields({
      email: normalizedEmail,
      cpf: normalizedCpf,
      phoneNormalized,
      excludeUserId: currentUser.id,
    })

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        name: normalizeText(payload.name),
        email: normalizedEmail,
        cpf: normalizedCpf,
        phone: payload.phone?.trim() || null,
        phoneNormalized,
        fullAddress: payload.fullAddress?.trim() || null,
        city: payload.city?.trim() || null,
        neighborhood: payload.neighborhood?.trim() || null,
      },
      include: authUserInclude,
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'UPDATE',
      entityType: 'account',
      entityId: currentUser.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: serializeAuthUser(currentUser),
      nextData: serializeAuthUser(updated),
    })

    response.json({
      user: serializeAuthUser(updated),
    })
  }),
)

accountRouter.put(
  '/password',
  asyncHandler(async (request, response) => {
    const payload = passwordSchema.parse(request.body)
    const currentUser = request.user!

    const matches = await bcrypt.compare(payload.currentPassword, currentUser.passwordHash)
    if (!matches) {
      throw new HttpError(400, 'Senha atual incorreta.')
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 10)
    await prisma.user.update({
      where: { id: currentUser.id },
      data: { passwordHash },
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'UPDATE',
      entityType: 'account_password',
      entityId: currentUser.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    })

    const refreshed = await prisma.user.findUniqueOrThrow({
      where: { id: currentUser.id },
      include: authUserInclude,
    })

    response.json({
      message: 'Senha atualizada com sucesso.',
      user: serializeAuthUser(refreshed),
    })
  }),
)
