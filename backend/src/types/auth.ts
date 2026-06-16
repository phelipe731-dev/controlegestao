import type { Prisma } from '@prisma/client'

export const authUserInclude = {
  role: true,
  leaderProfile: true,
  supervisorProfile: true,
} satisfies Prisma.UserInclude

export type AuthenticatedUser = Prisma.UserGetPayload<{
  include: typeof authUserInclude
}>
