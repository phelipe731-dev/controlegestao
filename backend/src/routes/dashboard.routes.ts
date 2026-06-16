import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { leaderScope, supervisorScope, supporterScope } from '../utils/scopes.js'

export const dashboardRouter = Router()

dashboardRouter.use(authenticate)

dashboardRouter.get(
  '/summary',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const [supporters, leaders, totalLeaders, totalSupervisors] = await Promise.all([
      prisma.supporter.findMany({
        where: supporterScope(currentUser),
        include: {
          leader: {
            include: {
              user: true,
            },
          },
        },
      }),
      prisma.leader.findMany({
        where: leaderScope(currentUser),
        include: {
          user: true,
        },
      }),
      prisma.leader.count({
        where: leaderScope(currentUser),
      }),
      prisma.supervisor.count({
        where: supervisorScope(currentUser),
      }),
    ])

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6)

    const totalToday = supporters.filter((supporter) => supporter.createdAt >= today).length
    const totalWeek = supporters.filter((supporter) => supporter.createdAt >= weekStart).length

    const createdMap = supporters.reduce<Record<string, number>>((accumulator, supporter) => {
      accumulator[supporter.createdByUserId] = (accumulator[supporter.createdByUserId] ?? 0) + 1
      return accumulator
    }, {})

    const ranking = leaders
      .map((leader) => ({
        leaderId: leader.id,
        leaderName: leader.user.name,
        total: createdMap[leader.userId] ?? 0,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 8)

    const chartByDayMap = new Map<string, number>()
    supporters.forEach((supporter) => {
      const label = supporter.createdAt.toISOString().slice(0, 10)
      chartByDayMap.set(label, (chartByDayMap.get(label) ?? 0) + 1)
    })

    const chartByLeaderMap = new Map<string, number>()
    supporters.forEach((supporter) => {
      const label = supporter.leader.user.name
      chartByLeaderMap.set(label, (chartByLeaderMap.get(label) ?? 0) + 1)
    })

    const cityMap = new Map<string, number>()
    const neighborhoodMap = new Map<string, number>()
    const zoneMap = new Map<string, number>()

    supporters.forEach((supporter) => {
      cityMap.set(supporter.city, (cityMap.get(supporter.city) ?? 0) + 1)
      neighborhoodMap.set(supporter.neighborhood, (neighborhoodMap.get(supporter.neighborhood) ?? 0) + 1)
      zoneMap.set(supporter.electoralZone, (zoneMap.get(supporter.electoralZone) ?? 0) + 1)
    })

    const chartFromMap = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([label, total]) => ({ label, total }))
        .sort((left, right) => right.total - left.total)

    response.json({
      cards: {
        totalSupporters: supporters.length,
        totalLeaders,
        totalSupervisors,
        totalToday,
        totalWeek,
      },
      ranking,
      charts: {
        byDay: Array.from(chartByDayMap.entries())
          .map(([date, total]) => ({ date, total }))
          .sort((left, right) => left.date.localeCompare(right.date)),
        byLeader: chartFromMap(chartByLeaderMap),
        byNeighborhood: chartFromMap(neighborhoodMap).slice(0, 10),
        byCity: chartFromMap(cityMap).slice(0, 10),
        byElectoralZone: chartFromMap(zoneMap).slice(0, 10),
      },
    })
  }),
)
