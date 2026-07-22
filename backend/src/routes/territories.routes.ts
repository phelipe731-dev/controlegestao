import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { leaderScope, supporterScope } from '../utils/scopes.js'

export const territoriesRouter = Router()

territoriesRouter.use(authenticate)

function territoryKey(city?: string | null, neighborhood?: string | null) {
  return `${city?.trim().toLowerCase() || 'nao informado'}::${neighborhood?.trim().toLowerCase() || 'nao informado'}`
}

territoriesRouter.get(
  '/overview',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const [supporters, leaders] = await Promise.all([
      prisma.supporter.findMany({
        where: supporterScope(request.user!),
        include: {
          leader: {
            include: {
              user: true,
            },
          },
        },
      }),
      prisma.leader.findMany({
        where: leaderScope(request.user!),
        include: {
          user: true,
        },
      }),
    ])

    const byTerritory = new Map<
      string,
      {
        city: string
        label: string
        totalSupporters: number
        leaders: Set<string>
        neighborhoods: Set<string>
        electoralZones: Set<string>
      }
    >()

    supporters.forEach((supporter) => {
      const key = territoryKey(supporter.city, supporter.neighborhood)
      const entry = byTerritory.get(key) ?? {
        city: supporter.city,
        label: supporter.neighborhood,
        totalSupporters: 0,
        leaders: new Set<string>(),
        neighborhoods: new Set<string>(),
        electoralZones: new Set<string>(),
      }

      entry.totalSupporters += 1
      entry.leaders.add(supporter.leader.user.name)
      entry.neighborhoods.add(supporter.neighborhood)
      entry.electoralZones.add(supporter.electoralZone)
      byTerritory.set(key, entry)
    })

    leaders.forEach((leader) => {
      const key = territoryKey(leader.user.city, leader.user.neighborhood)
      const entry = byTerritory.get(key) ?? {
        city: leader.user.city ?? 'Nao informado',
        label: leader.user.neighborhood ?? 'Nao informado',
        totalSupporters: 0,
        leaders: new Set<string>(),
        neighborhoods: new Set<string>(),
        electoralZones: new Set<string>(),
      }

      entry.leaders.add(leader.user.name)
      if (leader.user.neighborhood) {
        entry.neighborhoods.add(leader.user.neighborhood)
      }
      byTerritory.set(key, entry)
    })

    const territories = Array.from(byTerritory.values()).sort((left, right) => {
      const rightScore = right.totalSupporters + right.leaders.size
      const leftScore = left.totalSupporters + left.leaders.size
      return rightScore - leftScore || left.label.localeCompare(right.label)
    })
    const strongest = Math.max(...territories.map((item) => item.totalSupporters + item.leaders.size), 1)
    const zones = territories.map((territory, index) => {
      const score = territory.totalSupporters + territory.leaders.size
      const strength = Math.round((score / strongest) * 100)

      return {
        zone: territory.electoralZones.size > 0 ? Array.from(territory.electoralZones).sort().join('/') : `T${String(index + 1).padStart(2, '0')}`,
        label: territory.label,
        city: territory.city,
        x: index % 4,
        y: Math.floor(index / 4),
        totalSupporters: territory.totalSupporters,
        strength,
        leadersCount: territory.leaders.size,
        neighborhoodsCount: territory.neighborhoods.size,
        status: strength >= 70 ? 'forte' : strength >= 35 ? 'atencao' : 'expansao',
      }
    })

    const cityMap = new Map<string, { city: string; total: number }>()
    territories.forEach((territory) => {
      const current = cityMap.get(territory.city) ?? {
        city: territory.city,
        total: 0,
      }

      current.total += territory.totalSupporters + territory.leaders.size
      cityMap.set(territory.city, current)
    })

    response.json({
      metrics: {
        totalZones: zones.length,
        strongholds: zones.filter((zone) => zone.status === 'forte').length,
        expansionZones: zones.filter((zone) => zone.status === 'expansao').length,
        totalSupporters: supporters.length,
        totalLeaders: leaders.length,
      },
      zones,
      cityBreakdown: Array.from(cityMap.values()).sort((left, right) => right.total - left.total),
    })
  }),
)
