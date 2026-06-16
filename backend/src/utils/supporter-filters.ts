import type { Prisma, SupporterStatus } from '@prisma/client'
import type { AuthenticatedUser } from '../types/auth.js'
import { supporterScope } from './scopes.js'

export type SupporterFilterInput = {
  search?: string
  leaderId?: string
  supervisorId?: string
  city?: string
  neighborhood?: string
  electoralZone?: string
  status?: SupporterStatus
  periodStart?: string
  periodEnd?: string
}

export function buildSupporterWhere(user: AuthenticatedUser, filters: SupporterFilterInput): Prisma.SupporterWhereInput {
  const base = supporterScope(user)
  const leaderBase = (base.leader ?? {}) as Prisma.LeaderWhereInput

  const search = filters.search?.trim()
  const digitsSearch = search?.replace(/\D/g, '')

  return {
    ...base,
    leader: {
      ...leaderBase,
      ...(filters.supervisorId ? { supervisorId: filters.supervisorId } : {}),
    },
    ...(filters.leaderId ? { leaderId: filters.leaderId } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.neighborhood ? { neighborhood: filters.neighborhood } : {}),
    ...(filters.electoralZone ? { electoralZone: filters.electoralZone } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.periodStart || filters.periodEnd
      ? {
          createdAt: {
            ...(filters.periodStart ? { gte: new Date(`${filters.periodStart}T00:00:00.000Z`) } : {}),
            ...(filters.periodEnd ? { lte: new Date(`${filters.periodEnd}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search } },
            ...(digitsSearch ? [{ cpf: { contains: digitsSearch } }] : []),
            ...(digitsSearch ? [{ voterRegistration: { contains: digitsSearch } }] : []),
            ...(digitsSearch ? [{ phoneNormalized: { contains: digitsSearch } }] : []),
          ],
        }
      : {}),
  }
}
