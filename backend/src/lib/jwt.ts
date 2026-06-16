import jwt from 'jsonwebtoken'
import type { AuthenticatedUser } from '../types/auth.js'
import { env } from '../config/env.js'

type TokenPayload = {
  sub: string
  role: string
  leaderId?: string
  supervisorId?: string
}

export function signToken(user: AuthenticatedUser) {
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role.name,
    leaderId: user.leaderProfile?.id,
    supervisorId: user.supervisorProfile?.id,
  }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload
}
