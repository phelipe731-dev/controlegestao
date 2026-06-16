import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { HttpError } from '../utils/http-error.js'
import { supporterScope } from '../utils/scopes.js'

export const communicationsRouter = Router()

communicationsRouter.use(authenticate)

const channelPayloadSchema = z.object({
  name: z.string().min(3),
  type: z.enum(['WHATSAPP', 'SMS', 'EMAIL']),
  mode: z.enum(['API', 'QR', 'MANUAL']),
  providerName: z.string().optional().nullable(),
  apiBaseUrl: z.string().optional().nullable(),
  apiToken: z.string().optional().nullable(),
  senderId: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
})

const campaignPayloadSchema = z.object({
  title: z.string().min(3),
  subject: z.string().optional().nullable(),
  body: z.string().min(10),
  channelConfigId: z.string().min(1),
  audienceType: z.enum(['ALL_SUPPORTERS', 'CITY', 'ELECTORAL_ZONE', 'LEADER']),
  city: z.string().optional().nullable(),
  electoralZone: z.string().optional().nullable(),
  leaderId: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  notifyAllBase: z.boolean().default(false),
})

communicationsRouter.get(
  '/overview',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const [channels, campaigns, inbox, supporterCount] = await Promise.all([
      prisma.communicationChannelConfig.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.communicationCampaign.findMany({
        include: {
          channelConfig: true,
          recipients: true,
          createdByUser: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.communicationInboxMessage.findMany({
        include: {
          supporter: true,
          channelConfig: true,
        },
        orderBy: [{ readAt: 'asc' }, { receivedAt: 'desc' }],
        take: 12,
      }),
      prisma.supporter.count({
        where: supporterScope(request.user!),
      }),
    ])

    response.json({
      metrics: {
        connectedChannels: channels.filter((channel) => ['CONNECTED', 'READY'].includes(channel.status)).length,
        queuedCampaigns: campaigns.filter((campaign) => campaign.status === 'QUEUED').length,
        unreadInbox: inbox.filter((item) => !item.readAt).length,
        baseReach: supporterCount,
      },
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        mode: channel.mode,
        status: channel.status,
        providerName: channel.providerName,
        apiBaseUrl: channel.apiBaseUrl,
        senderId: channel.senderId,
        phoneNumber: channel.phoneNumber,
        qrToken: channel.qrToken,
        isDefault: channel.isDefault,
        lastSyncAt: channel.lastSyncAt,
      })),
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        title: campaign.title,
        subject: campaign.subject,
        body: campaign.body,
        status: campaign.status,
        audienceType: campaign.audienceType,
        city: campaign.city,
        electoralZone: campaign.electoralZone,
        leaderId: campaign.leaderId,
        notifyAllBase: campaign.notifyAllBase,
        scheduledAt: campaign.scheduledAt,
        sentAt: campaign.sentAt,
        channelName: campaign.channelConfig.name,
        channelType: campaign.channelConfig.type,
        createdByName: campaign.createdByUser.name,
        recipientsCount: campaign.recipients.length,
        deliveredCount: campaign.recipients.filter((recipient) => recipient.status === 'SENT').length,
        createdAt: campaign.createdAt,
      })),
      inbox: inbox.map((item) => ({
        id: item.id,
        senderName: item.senderName,
        senderAddress: item.senderAddress,
        channelType: item.channelType,
        subject: item.subject,
        body: item.body,
        receivedAt: item.receivedAt,
        readAt: item.readAt,
        supporterName: item.supporter?.fullName ?? null,
        channelName: item.channelConfig?.name ?? null,
      })),
    })
  }),
)

communicationsRouter.post(
  '/channels',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const payload = channelPayloadSchema.parse(request.body)

    if (payload.isDefault) {
      await prisma.communicationChannelConfig.updateMany({
        where: {
          type: payload.type,
        },
        data: {
          isDefault: false,
        },
      })
    }

    const channel = await prisma.communicationChannelConfig.create({
      data: {
        ...payload,
        status: payload.mode === 'QR' ? 'CONNECTING' : 'READY',
        qrToken: payload.mode === 'QR' ? `PAIR-${Date.now()}` : null,
      },
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'CREATE',
      entityType: 'communication_channel',
      entityId: channel.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: channel,
    })

    response.status(201).json({ channel })
  }),
)

communicationsRouter.post(
  '/channels/:id/qrcode',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const channelId = String(request.params.id)
    const channel = await prisma.communicationChannelConfig.findUnique({
      where: { id: channelId },
    })

    if (!channel) {
      throw new HttpError(404, 'Canal nao encontrado.')
    }

    if (channel.mode !== 'QR') {
      throw new HttpError(400, 'Este canal nao utiliza conexao por QR Code.')
    }

    const qrToken = `PAIR-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`
    const updated = await prisma.communicationChannelConfig.update({
      where: { id: channelId },
      data: {
        qrToken,
        status: 'CONNECTING',
        lastSyncAt: new Date(),
      },
    })

    response.json({
      channel: updated,
      qrValue: `whatsapp://pair?token=${qrToken}`,
    })
  }),
)

communicationsRouter.post(
  '/campaigns',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const payload = campaignPayloadSchema.parse(request.body)

    const channel = await prisma.communicationChannelConfig.findUnique({
      where: { id: payload.channelConfigId },
    })

    if (!channel) {
      throw new HttpError(404, 'Canal de comunicacao nao encontrado.')
    }

    const audienceWhere =
      payload.audienceType === 'ALL_SUPPORTERS'
        ? supporterScope(currentUser)
        : {
            ...supporterScope(currentUser),
            ...(payload.audienceType === 'CITY' ? { city: payload.city ?? undefined } : {}),
            ...(payload.audienceType === 'ELECTORAL_ZONE' ? { electoralZone: payload.electoralZone ?? undefined } : {}),
            ...(payload.audienceType === 'LEADER' ? { leaderId: payload.leaderId ?? undefined } : {}),
          }

    const audience = await prisma.supporter.findMany({
      where: audienceWhere,
      select: {
        id: true,
      },
    })

    if (audience.length === 0) {
      throw new HttpError(400, 'Nenhum apoiador encontrado para o publico selecionado.')
    }

    const campaign = await prisma.communicationCampaign.create({
      data: {
        title: payload.title,
        subject: payload.subject || null,
        body: payload.body,
        channelConfigId: payload.channelConfigId,
        audienceType: payload.audienceType,
        city: payload.city || null,
        electoralZone: payload.electoralZone || null,
        leaderId: payload.leaderId || null,
        notifyAllBase: payload.notifyAllBase,
        status: payload.scheduledAt ? 'SCHEDULED' : 'QUEUED',
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        createdByUserId: currentUser.id,
        recipients: {
          create: audience.map((supporter) => ({
            supporterId: supporter.id,
            status: 'QUEUED',
          })),
        },
      },
      include: {
        recipients: true,
        channelConfig: true,
      },
    })

    await writeAuditLog({
      actorUserId: currentUser.id,
      action: 'CREATE',
      entityType: 'communication_campaign',
      entityId: campaign.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: {
        ...campaign,
        recipientsCount: campaign.recipients.length,
      },
    })

    response.status(201).json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        recipientsCount: campaign.recipients.length,
        channelName: campaign.channelConfig.name,
      },
    })
  }),
)

communicationsRouter.patch(
  '/inbox/:id/read',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const messageId = String(request.params.id)
    const updated = await prisma.communicationInboxMessage.update({
      where: { id: messageId },
      data: {
        readAt: new Date(),
      },
    })

    response.json({ message: updated })
  }),
)
