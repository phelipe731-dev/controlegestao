import type { Prisma, UserStatus } from '@prisma/client'
import type { AuthenticatedUser } from '../types/auth.js'
import { leaderScope } from './scopes.js'

export type LeaderFilterInput = {
  search?: string
  supervisorId?: string
  city?: string
  neighborhood?: string
  status?: UserStatus
}

const containsInsensitive = (value: string) => ({
  contains: value,
  mode: 'insensitive' as const,
})

export function buildLeaderWhere(user: AuthenticatedUser, filters: LeaderFilterInput): Prisma.LeaderWhereInput {
  const and: Prisma.LeaderWhereInput[] = [leaderScope(user)]
  const search = filters.search?.trim()
  const digitsSearch = search?.replace(/\D/g, '')

  if (filters.supervisorId) {
    and.push({ supervisorId: filters.supervisorId })
  }

  if (filters.status) {
    and.push({ user: { status: filters.status } })
  }

  if (filters.city?.trim()) {
    and.push({ user: { city: containsInsensitive(filters.city.trim()) } })
  }

  if (filters.neighborhood?.trim()) {
    and.push({ user: { neighborhood: containsInsensitive(filters.neighborhood.trim()) } })
  }

  if (search) {
    and.push({
      OR: [
        { user: { name: containsInsensitive(search) } },
        { user: { email: containsInsensitive(search) } },
        { user: { fullAddress: containsInsensitive(search) } },
        { supervisor: { user: { name: containsInsensitive(search) } } },
        ...(digitsSearch
          ? [
              { user: { cpf: { contains: digitsSearch } } },
              { user: { phoneNormalized: { contains: digitsSearch } } },
            ]
          : []),
      ],
    })
  }

  return {
    AND: and,
  }
}
