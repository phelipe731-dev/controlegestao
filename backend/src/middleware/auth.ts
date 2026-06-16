import type { RequestHandler } from 'express'
import { prisma } from '../lib/prisma.js'
import { verifyToken } from '../lib/jwt.js'
import { authUserInclude } from '../types/auth.js'
import { HttpError } from '../utils/http-error.js'

export const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const authorization = request.headers.authorization
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

    if (!token) {
      throw new HttpError(401, 'Sessao invalida. Faca login novamente.')
    }

    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: authUserInclude,
    })

    if (!user || user.status !== 'ACTIVE') {
      throw new HttpError(401, 'Usuario nao autorizado.')
    }

    request.user = user
    next()
  } catch (error) {
    next(error)
  }
}

export const authorize =
  (...roles: Array<'ADMIN' | 'SUPERVISOR' | 'LEADER'>): RequestHandler =>
  (request, _response, next) => {
    if (!request.user) {
      return next(new HttpError(401, 'Usuario nao autenticado.'))
    }

    if (!roles.includes(request.user.role.name)) {
      return next(new HttpError(403, 'Voce nao possui permissao para esta acao.'))
    }

    return next()
  }
