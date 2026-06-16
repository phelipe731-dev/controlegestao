import type { Prisma } from '@prisma/client'
import type { AuthenticatedUser } from '../types/auth.js'

export const leaderListInclude = {
  user: true,
  supervisor: {
    include: {
      user: true,
    },
  },
  _count: {
    select: {
      supporters: true,
    },
  },
} satisfies Prisma.LeaderInclude

export const supervisorListInclude = {
  user: true,
} satisfies Prisma.SupervisorInclude

export const supporterListInclude = {
  leader: {
    include: {
      user: true,
      supervisor: {
        include: {
          user: true,
        },
      },
    },
  },
  createdByUser: true,
} satisfies Prisma.SupporterInclude

export type LeaderWithRelations = Prisma.LeaderGetPayload<{
  include: typeof leaderListInclude
}>

export type SupervisorWithRelations = Prisma.SupervisorGetPayload<{
  include: typeof supervisorListInclude
}>

export type SupporterWithRelations = Prisma.SupporterGetPayload<{
  include: typeof supporterListInclude
}>

export function serializeAuthUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    cpf: user.cpf,
    phone: user.phone,
    status: user.status,
    city: user.city,
    neighborhood: user.neighborhood,
    fullAddress: user.fullAddress,
    role: user.role.name,
    leaderId: user.leaderProfile?.id ?? null,
    supervisorId: user.supervisorProfile?.id ?? null,
    canCreateLeaders: user.supervisorProfile?.canCreateLeaders ?? false,
  }
}

export function serializeLeader(leader: LeaderWithRelations, createdCount = 0) {
  return {
    id: leader.id,
    name: leader.user.name,
    cpf: leader.user.cpf,
    phone: leader.user.phone,
    email: leader.user.email,
    fullAddress: leader.user.fullAddress,
    city: leader.user.city,
    neighborhood: leader.user.neighborhood,
    status: leader.user.status,
    supervisorId: leader.supervisorId,
    supervisorName: leader.supervisor?.user.name ?? null,
    supportersCount: leader._count?.supporters ?? 0,
    createdRegistrations: createdCount,
    userId: leader.userId,
    createdAt: leader.createdAt,
    updatedAt: leader.updatedAt,
  }
}

export function serializeSupervisor(supervisor: SupervisorWithRelations, leadersCount = 0) {
  return {
    id: supervisor.id,
    name: supervisor.user.name,
    cpf: supervisor.user.cpf,
    phone: supervisor.user.phone,
    email: supervisor.user.email,
    fullAddress: supervisor.user.fullAddress,
    city: supervisor.user.city,
    neighborhood: supervisor.user.neighborhood,
    status: supervisor.user.status,
    canCreateLeaders: supervisor.canCreateLeaders,
    leadersCount,
    userId: supervisor.userId,
    createdAt: supervisor.createdAt,
    updatedAt: supervisor.updatedAt,
  }
}

export function serializeSupporter(supporter: SupporterWithRelations) {
  return {
    id: supporter.id,
    fullName: supporter.fullName,
    cpf: supporter.cpf,
    phone: supporter.phone,
    birthDate: supporter.birthDate,
    fullAddress: supporter.fullAddress,
    postalCode: supporter.postalCode,
    street: supporter.street,
    number: supporter.number,
    complement: supporter.complement,
    neighborhood: supporter.neighborhood,
    city: supporter.city,
    state: supporter.state,
    voterRegistration: supporter.voterRegistration,
    electoralZone: supporter.electoralZone,
    electoralSection: supporter.electoralSection,
    notes: supporter.notes,
    consentAccepted: supporter.consentAccepted,
    consentSource: supporter.consentSource,
    consentAcceptedAt: supporter.consentAcceptedAt,
    status: supporter.status,
    leaderId: supporter.leaderId,
    leaderName: supporter.leader.user.name,
    supervisorName: supporter.leader.supervisor?.user.name ?? null,
    createdByUserId: supporter.createdByUserId,
    createdByUserName: supporter.createdByUser.name,
    createdAt: supporter.createdAt,
    updatedAt: supporter.updatedAt,
  }
}
