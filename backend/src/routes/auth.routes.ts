import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { signToken } from '../lib/jwt.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { HttpError } from '../utils/http-error.js'
import { normalizeEmail } from '../utils/normalizers.js'
import { serializeAuthUser } from '../utils/serializers.js'
import { authUserInclude } from '../types/auth.js'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
})

authRouter.post(
  '/login',
  asyncHandler(async (request, response) => {
    const payload = loginSchema.parse(request.body)
    const email = normalizeEmail(payload.email)

    const user = await prisma.user.findUnique({
      where: { email },
      include: authUserInclude,
    })

    const passwordMatches = user ? await bcrypt.compare(payload.password, user.passwordHash) : false
    const success = Boolean(user && passwordMatches && user.status === 'ACTIVE')

    await prisma.loginLog.create({
      data: {
        userId: user?.id ?? null,
        email,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        success,
      },
    })

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      throw new HttpError(401, 'Credenciais invalidas.')
    }

    const token = signToken(user)

    await writeAuditLog({
      actorUserId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: { email: user.email },
    })

    response.json({
      token,
      user: serializeAuthUser(user),
    })
  }),
)

authRouter.post(
  '/forgot-password',
  asyncHandler(async (request, response) => {
    const payload = forgotPasswordSchema.parse(request.body)
    const email = normalizeEmail(payload.email)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    let resetToken: string | undefined

    if (user) {
      resetToken = randomBytes(24).toString('hex')

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
      })

      await writeAuditLog({
        actorUserId: user.id,
        action: 'REQUEST_PASSWORD_RESET',
        entityType: 'user',
        entityId: user.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        nextData: { email },
      })
    }

    response.json({
      message: 'Se o e-mail estiver cadastrado, um token de redefinicao foi gerado.',
      resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    })
  }),
)

authRouter.post(
  '/reset-password',
  asyncHandler(async (request, response) => {
    const payload = resetPasswordSchema.parse(request.body)

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: payload.token },
      include: { user: true },
    })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new HttpError(400, 'Token invalido ou expirado.')
    }

    const passwordHash = await bcrypt.hash(payload.password, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    await writeAuditLog({
      actorUserId: resetToken.userId,
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: resetToken.userId,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    })

    response.json({
      message: 'Senha redefinida com sucesso.',
    })
  }),
)

authRouter.get(
  '/session',
  authenticate,
  asyncHandler(async (request, response) => {
    response.json({
      user: serializeAuthUser(request.user!),
    })
  }),
)
