import type { Prisma } from '@prisma/client'
import type { AuthenticatedUser } from '../types/auth.js'

export function supporterScope(user: AuthenticatedUser): Prisma.SupporterWhereInput {
  switch (user.role.name) {
    case 'ADMIN':
      return {}
    case 'SUPERVISOR':
      return {
        leader: {
          supervisor: {
            userId: user.id,
          },
        },
      }
    case 'LEADER':
      return {
        leader: {
          userId: user.id,
        },
      }
  }
}

export function leaderScope(user: AuthenticatedUser): Prisma.LeaderWhereInput {
  switch (user.role.name) {
    case 'ADMIN':
      return {}
    case 'SUPERVISOR':
      return {
        supervisor: {
          userId: user.id,
        },
      }
    case 'LEADER':
      return {
        userId: user.id,
      }
  }
}

export function supervisorScope(user: AuthenticatedUser): Prisma.SupervisorWhereInput {
  switch (user.role.name) {
    case 'ADMIN':
      return {}
    case 'SUPERVISOR':
      return {
        userId: user.id,
      }
    case 'LEADER':
      return {
        id: '__none__',
      }
  }
}

export function mergeScopes<T extends object>(baseScope: T, extraScope?: Partial<T>): T {
  return {
    ...baseScope,
    ...(extraScope ?? {}),
  }
}
