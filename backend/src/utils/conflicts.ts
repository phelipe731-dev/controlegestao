import { prisma } from '../lib/prisma.js'
import { HttpError } from './http-error.js'

type UserConflictInput = {
  email: string
  cpf: string
  phoneNormalized?: string | null
  excludeUserId?: string
}

export async function ensureUniqueUserFields(input: UserConflictInput) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: input.email },
        { cpf: input.cpf },
        ...(input.phoneNormalized ? [{ phoneNormalized: input.phoneNormalized }] : []),
      ],
      NOT: input.excludeUserId ? { id: input.excludeUserId } : undefined,
    },
    select: {
      id: true,
      email: true,
      cpf: true,
      phoneNormalized: true,
    },
  })

  const emailConflict = users.find((user) => user.email === input.email)
  if (emailConflict) {
    throw new HttpError(409, 'Ja existe um usuario com este e-mail.')
  }

  const cpfConflict = users.find((user) => user.cpf === input.cpf)
  if (cpfConflict) {
    throw new HttpError(409, 'Ja existe um usuario com este CPF.')
  }

  if (input.phoneNormalized) {
    const phoneConflict = users.find((user) => user.phoneNormalized === input.phoneNormalized)
    if (phoneConflict) {
      throw new HttpError(409, 'Ja existe um usuario com este telefone.')
    }
  }
}

type SupporterConflictInput = {
  cpf: string
  phoneNormalized?: string | null
  voterRegistration: string
  excludeSupporterId?: string
}

export async function findSupporterConflict(input: SupporterConflictInput) {
  const conflicts = await prisma.supporter.findMany({
    where: {
      OR: [
        { cpf: input.cpf },
        { voterRegistration: input.voterRegistration },
        ...(input.phoneNormalized ? [{ phoneNormalized: input.phoneNormalized }] : []),
      ],
      NOT: input.excludeSupporterId ? { id: input.excludeSupporterId } : undefined,
    },
    include: {
      leader: {
        include: {
          user: true,
        },
      },
    },
  })

  const cpfConflict = conflicts.find((supporter) => supporter.cpf === input.cpf)
  if (cpfConflict) {
    return {
      type: 'cpf',
      supporter: cpfConflict,
    } as const
  }

  const voterConflict = conflicts.find((supporter) => supporter.voterRegistration === input.voterRegistration)
  if (voterConflict) {
    return {
      type: 'voterRegistration',
      supporter: voterConflict,
    } as const
  }

  if (input.phoneNormalized) {
    const phoneConflict = conflicts.find((supporter) => supporter.phoneNormalized === input.phoneNormalized)
    if (phoneConflict) {
      return {
        type: 'phone',
        supporter: phoneConflict,
      } as const
    }
  }

  return null
}
