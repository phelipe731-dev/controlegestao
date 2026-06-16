import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

const sanitize = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item)) as Prisma.InputJsonArray
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !['passwordHash', 'token'].includes(key))
      .map(([key, entryValue]) => [key, sanitize(entryValue)])

    return Object.fromEntries(entries) as Prisma.InputJsonObject
  }

  if (value === null) {
    return Prisma.JsonNull
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return String(value)
}

type AuditInput = {
  actorUserId?: string | null
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'TRANSFER'
    | 'LOGIN'
    | 'REQUEST_PASSWORD_RESET'
    | 'RESET_PASSWORD'
    | 'ANONYMIZE'
  entityType: string
  entityId: string
  ipAddress?: string | null
  userAgent?: string | null
  previousData?: unknown
  nextData?: unknown
}

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      previousData: input.previousData ? sanitize(input.previousData) : undefined,
      nextData: input.nextData ? sanitize(input.nextData) : undefined,
    },
  })
}
