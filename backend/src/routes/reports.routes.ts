import dayjs from 'dayjs'
import { Router } from 'express'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { serializeSupporter, supporterListInclude } from '../utils/serializers.js'
import { buildSupporterWhere } from '../utils/supporter-filters.js'

export const reportsRouter = Router()

reportsRouter.use(authenticate)

const statusSchema = z.enum(['ACTIVE', 'ARCHIVED', 'ANONYMIZED'])
const exportSchema = z.enum(['csv', 'xlsx'])

const querySchema = z.object({
  search: z.string().optional(),
  leaderId: z.string().optional(),
  supervisorId: z.string().optional(),
  city: z.string().optional(),
  neighborhood: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  status: statusSchema.optional(),
})

function toReportRows(supporters: ReturnType<typeof serializeSupporter>[]) {
  return supporters.map((supporter) => ({
    Nome: supporter.fullName,
    CPF: supporter.cpf,
    Telefone: supporter.phone ?? '',
    Endereco: supporter.fullAddress,
    Cidade: supporter.city,
    Bairro: supporter.neighborhood,
    Lider: supporter.leaderName,
    Supervisor: supporter.supervisorName ?? '',
    Status: supporter.status,
    Consentimento: supporter.consentAccepted ? 'Sim' : 'Nao',
    OrigemConsentimento: supporter.consentSource,
    CadastradoEm: dayjs(supporter.createdAt).format('DD/MM/YYYY HH:mm'),
  }))
}

reportsRouter.get(
  '/supporters/options',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const rows = await prisma.supporter.findMany({
      where: buildSupporterWhere(request.user!, {}),
      select: {
        city: true,
        neighborhood: true,
      },
      distinct: ['city', 'neighborhood'],
      orderBy: [
        { city: 'asc' },
        { neighborhood: 'asc' },
      ],
    })

    const pairs = rows
      .filter((item) => item.city?.trim() && item.neighborhood?.trim())
      .map((item) => ({
        city: item.city,
        neighborhood: item.neighborhood,
      }))

    response.json({
      cities: Array.from(new Set(pairs.map((item) => item.city))).sort((left, right) => left.localeCompare(right)),
      neighborhoods: Array.from(new Set(pairs.map((item) => item.neighborhood))).sort((left, right) => left.localeCompare(right)),
      pairs,
    })
  }),
)

reportsRouter.get(
  '/supporters',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const query = querySchema.parse(request.query)
    const supporters = await prisma.supporter.findMany({
      where: buildSupporterWhere(request.user!, query),
      include: supporterListInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })

    const serialized = supporters.map(serializeSupporter)

    const summaryByLeaderMap = new Map<string, { leaderId: string; leaderName: string; total: number }>()
    serialized.forEach((supporter) => {
      const current = summaryByLeaderMap.get(supporter.leaderId)
      if (current) {
        current.total += 1
        return
      }

      summaryByLeaderMap.set(supporter.leaderId, {
        leaderId: supporter.leaderId,
        leaderName: supporter.leaderName,
        total: 1,
      })
    })

    response.json({
      filters: query,
      total: serialized.length,
      supporters: serialized,
      summaryByLeader: Array.from(summaryByLeaderMap.values()).sort((left, right) => right.total - left.total),
    })
  }),
)

reportsRouter.get(
  '/supporters/export',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const query = querySchema.extend({
      format: exportSchema.default('csv'),
    }).parse(request.query)

    const supporters = await prisma.supporter.findMany({
      where: buildSupporterWhere(request.user!, query),
      include: supporterListInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })

    const rows = toReportRows(supporters.map(serializeSupporter))
    const worksheet = XLSX.utils.json_to_sheet(rows)

    if (query.format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(worksheet)
      response.setHeader('Content-Type', 'text/csv; charset=utf-8')
      response.setHeader('Content-Disposition', 'attachment; filename="relatorio-apoiadores.csv"')
      response.send(csv)
      return
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Apoiadores')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response.setHeader('Content-Disposition', 'attachment; filename="relatorio-apoiadores.xlsx"')
    response.send(buffer)
  }),
)
