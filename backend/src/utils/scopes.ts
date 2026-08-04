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

export function demandScope(user: AuthenticatedUser): Prisma.CabinetDemandWhereInput {
  switch (user.role.name) {
    case 'ADMIN':
      return {}
    case 'SUPERVISOR':
      return {
        OR: [
          { createdByUserId: user.id },
          { responsibleUserId: user.id },
          {
            createdByUser: {
              leaderProfile: {
                supervisor: {
                  userId: user.id,
                },
              },
            },
          },
          {
            responsibleUser: {
              leaderProfile: {
                supervisor: {
                  userId: user.id,
                },
              },
            },
          },
        ],
      }
    case 'LEADER':
      return {
        OR: [
          { createdByUserId: user.id },
          { responsibleUserId: user.id },
        ],
      }
  }
}

export function dobradaPauloAlexandreLeaderScope(user: AuthenticatedUser): Prisma.DobradaPauloAlexandreLeaderWhereInput {
  switch (user.role.name) {
    case 'ADMIN':
      return {}
    case 'SUPERVISOR':
      return {
        createdByUserId: user.id,
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
