import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { supporterScope } from '../utils/scopes.js'

export const territoriesRouter = Router()

territoriesRouter.use(authenticate)

const zoneLayout = [
  { zone: '101', label: 'Zona Norte', x: 1, y: 0, city: 'Cidade Base' },
  { zone: '102', label: 'Centro Expandido', x: 2, y: 1, city: 'Cidade Base' },
  { zone: '103', label: 'Zona Leste', x: 3, y: 1, city: 'Cidade Base' },
  { zone: '104', label: 'Zona Sul', x: 1, y: 2, city: 'Cidade Base' },
  { zone: '105', label: 'Zona Oeste', x: 0, y: 1, city: 'Cidade Base' },
  { zone: '106', label: 'Polo Metropolitano', x: 4, y: 1, city: 'Cidade Vizinha' },
]

territoriesRouter.get(
  '/overview',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const supporters = await prisma.supporter.findMany({
      where: supporterScope(request.user!),
      include: {
        leader: {
          include: {
            user: true,
          },
        },
      },
    })

    const byZone = new Map<string, { total: number; leaders: Set<string>; neighborhoods: Set<string>; city: string }>()

    supporters.forEach((supporter) => {
      const entry = byZone.get(supporter.electoralZone) ?? {
        total: 0,
        leaders: new Set<string>(),
        neighborhoods: new Set<string>(),
        city: supporter.city,
      }

      entry.total += 1
      entry.leaders.add(supporter.leader.user.name)
      entry.neighborhoods.add(supporter.neighborhood)
      byZone.set(supporter.electoralZone, entry)
    })

    const strongest = Math.max(...Array.from(byZone.values()).map((item) => item.total), 1)
    const zones = zoneLayout.map((zone) => {
      const metrics = byZone.get(zone.zone)
      const total = metrics?.total ?? 0
      const strength = Math.round((total / strongest) * 100)

      return {
        zone: zone.zone,
        label: zone.label,
        city: metrics?.city ?? zone.city,
        x: zone.x,
        y: zone.y,
        totalSupporters: total,
        strength,
        leadersCount: metrics?.leaders.size ?? 0,
        neighborhoodsCount: metrics?.neighborhoods.size ?? 0,
        status: total >= strongest * 0.7 ? 'forte' : total >= strongest * 0.35 ? 'atencao' : 'expansao',
      }
    })

    response.json({
      metrics: {
        totalZones: zones.length,
        strongholds: zones.filter((zone) => zone.status === 'forte').length,
        expansionZones: zones.filter((zone) => zone.status === 'expansao').length,
        totalSupporters: supporters.length,
      },
      zones,
      cityBreakdown: Object.values(
        supporters.reduce<Record<string, { city: string; total: number }>>((accumulator, supporter) => {
          if (!accumulator[supporter.city]) {
            accumulator[supporter.city] = { city: supporter.city, total: 0 }
          }
          accumulator[supporter.city].total += 1
          return accumulator
        }, {}),
      ).sort((left, right) => right.total - left.total),
    })
  }),
)
