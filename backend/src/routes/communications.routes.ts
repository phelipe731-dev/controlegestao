import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'
import { writeAuditLog } from '../utils/audit.js'
import { HttpError } from '../utils/http-error.js'
import { supporterScope } from '../utils/scopes.js'
import {
  connectWahaSession,
  getWahaConnectionStatus,
  getWahaSessionName,
  isWahaConfigured,
  logoutWahaSession,
  sendWahaTextMessage,
} from '../lib/waha.js'
import { env } from '../config/env.js'

export const communicationsRouter = Router()

communicationsRouter.post(
  '/webhook/waha',
  asyncHandler(async (request, response) => {
    if (env.WAHA_WEBHOOK_SECRET && request.headers['x-campanhahub-webhook-secret'] !== env.WAHA_WEBHOOK_SECRET) {
      throw new HttpError(401, 'Webhook nao autorizado.')
    }

    const body = request.body as Record<string, unknown>
    const event = String(body.event ?? body.type ?? '').toUpperCase()
    const session = String(body.session ?? body.sessionName ?? '')

    if (session && session !== env.WAHA_SESSION) {
      response.json({ ok: true })
      return
    }

    const channel = await findWhatsAppQrChannel()
    if (!channel) {
      response.json({ ok: true })
      return
    }

    if (event.includes('SESSION.STATUS')) {
      const state = String((body.payload as Record<string, unknown> | undefined)?.status ?? body.status ?? '').toUpperCase()
      const status = state === 'WORKING'
        ? 'READY'
        : state === 'STOPPED'
          ? 'DRAFT'
          : 'CONNECTING'

      await prisma.communicationChannelConfig.update({
        where: { id: channel.id },
        data: {
          status,
          lastSyncAt: new Date(),
          qrToken: status === 'READY' ? null : channel.qrToken,
        },
      })
    }

    response.json({ ok: true })
  }),
)

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
  channelConfigId: z.string().min(1).optional().nullable(),
  audienceType: z.enum(['ALL_SUPPORTERS', 'CITY', 'ELECTORAL_ZONE', 'LEADER']),
  city: z.string().optional().nullable(),
  electoralZone: z.string().optional().nullable(),
  leaderId: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  notifyAllBase: z.boolean().default(false),
  saveAsDraft: z.boolean().default(false),
})

const audienceEstimateSchema = z.object({
  audienceType: z.enum(['ALL_SUPPORTERS', 'CITY', 'ELECTORAL_ZONE', 'LEADER']).default('ALL_SUPPORTERS'),
  city: z.string().optional().nullable(),
  electoralZone: z.string().optional().nullable(),
  leaderId: z.string().optional().nullable(),
})

function campaignScope(user: NonNullable<Express.Request['user']>): Prisma.CommunicationCampaignWhereInput {
  switch (user.role.name) {
    case 'ADMIN':
      return {}
    case 'SUPERVISOR':
      return {
        OR: [
          { createdByUserId: user.id },
          {
            createdByUser: {
              leaderProfile: {
                supervisor: {
                  userId: user.id,
                },
              },
            },
          },
        ],
      }
    case 'LEADER':
      return {
        createdByUserId: user.id,
      }
  }
}

function inboxScope(user: NonNullable<Express.Request['user']>): Prisma.CommunicationInboxMessageWhereInput {
  if (user.role.name === 'ADMIN') {
    return {}
  }

  return {
    supporter: supporterScope(user),
  }
}

function buildAudienceWhere(
  user: NonNullable<Express.Request['user']>,
  payload: z.infer<typeof audienceEstimateSchema>,
): Prisma.SupporterWhereInput {
  return payload.audienceType === 'ALL_SUPPORTERS'
    ? supporterScope(user)
    : {
        ...supporterScope(user),
        ...(payload.audienceType === 'CITY' ? { city: payload.city ?? undefined } : {}),
        ...(payload.audienceType === 'ELECTORAL_ZONE' ? { electoralZone: payload.electoralZone ?? undefined } : {}),
        ...(payload.audienceType === 'LEADER' ? { leaderId: payload.leaderId ?? undefined } : {}),
      }
}

async function findWhatsAppQrChannel(channelId?: string | null) {
  if (channelId) {
    return prisma.communicationChannelConfig.findFirst({
      where: {
        id: channelId,
        type: 'WHATSAPP',
        mode: 'QR',
      },
    })
  }

  return prisma.communicationChannelConfig.findFirst({
    where: {
      type: 'WHATSAPP',
      mode: 'QR',
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
}

async function syncWhatsAppQrChannel() {
  const channel = await findWhatsAppQrChannel()
  if (!channel || !isWahaConfigured()) return channel

  try {
    const state = await getWahaConnectionStatus()
    const status = state === 'working' ? 'READY' : state === 'stopped' ? 'DRAFT' : ['scan_qr', 'starting'].includes(state) ? 'CONNECTING' : channel.status

    if (status !== channel.status) {
      return prisma.communicationChannelConfig.update({
        where: { id: channel.id },
        data: {
          status,
          lastSyncAt: new Date(),
          qrToken: status === 'READY' ? null : channel.qrToken,
        },
      })
    }
  } catch {
    return prisma.communicationChannelConfig.update({
      where: { id: channel.id },
      data: {
        status: 'ERROR',
        lastSyncAt: new Date(),
      },
    })
  }

  return channel
}

async function dispatchImmediateWhatsAppCampaign(campaignId: string, message: string) {
  if (!isWahaConfigured()) return

  const recipients = await prisma.campaignRecipient.findMany({
    where: {
      campaignId,
      status: 'QUEUED',
      supporter: {
        phone: {
          not: null,
        },
      },
    },
    include: {
      supporter: true,
    },
  })

  let sentCount = 0

  for (const recipient of recipients) {
    try {
      const result = await sendWahaTextMessage(recipient.supporter.phone ?? '', message)
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'SENT',
          externalId: typeof result.key === 'string' ? result.key : null,
          sentAt: new Date(),
        },
      })
      sentCount += 1
    } catch (error) {
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'FAILED',
          externalId: error instanceof Error ? error.message.slice(0, 180) : 'Falha no envio',
        },
      })
    }
  }

  await prisma.communicationCampaign.update({
    where: { id: campaignId },
    data: {
      status: sentCount > 0 ? 'SENT' : 'FAILED',
      sentAt: sentCount > 0 ? new Date() : null,
    },
  })
}

communicationsRouter.get(
  '/overview',
  authorize('ADMIN', 'SUPERVISOR', 'LEADER'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    await syncWhatsAppQrChannel()

    const [channels, campaigns, inbox, supporterCount] = await Promise.all([
      prisma.communicationChannelConfig.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.communicationCampaign.findMany({
        where: campaignScope(currentUser),
        include: {
          channelConfig: true,
          recipients: true,
          createdByUser: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.communicationInboxMessage.findMany({
        where: inboxScope(currentUser),
        include: {
          supporter: true,
          channelConfig: true,
        },
        orderBy: [{ readAt: 'asc' }, { receivedAt: 'desc' }],
        take: 12,
      }),
      prisma.supporter.count({
        where: supporterScope(currentUser),
      }),
    ])

    response.json({
      metrics: {
        connectedChannels: channels.filter((channel) => channel.type === 'WHATSAPP' && channel.mode === 'QR' && ['CONNECTED', 'READY'].includes(channel.status)).length,
        queuedCampaigns: campaigns.filter((campaign) => campaign.status === 'QUEUED').length,
        unreadInbox: inbox.filter((item) => !item.readAt).length,
        baseReach: supporterCount,
      },
      integration: {
        evolutionConfigured: isWahaConfigured(),
        instanceName: getWahaSessionName(),
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

communicationsRouter.get(
  '/audience-estimate',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const payload = audienceEstimateSchema.parse(request.query)
    const total = await prisma.supporter.count({
      where: buildAudienceWhere(request.user!, payload),
    })

    response.json({ total })
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
  '/channels/whatsapp-qr',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const existing = await findWhatsAppQrChannel()

    if (existing) {
      if (isWahaConfigured()) {
        const qr = await connectWahaSession()
        const updated = await prisma.communicationChannelConfig.update({
          where: { id: existing.id },
          data: {
            providerName: 'WAHA',
            apiBaseUrl: env.WAHA_API_URL,
            senderId: getWahaSessionName(),
            status: 'CONNECTING',
            qrToken: qr.base64 ?? qr.code,
            lastSyncAt: new Date(),
          },
        })

        response.json({ channel: updated, qrValue: qr.code, qrCodeBase64: qr.base64, evolutionConfigured: true })
        return
      }

      response.json({ channel: existing })
      return
    }

    const channel = await prisma.communicationChannelConfig.create({
      data: {
        id: 'channel_whatsapp_qr_primary',
        name: 'WhatsApp Business QR',
        type: 'WHATSAPP',
        mode: 'QR',
        status: 'DRAFT',
        providerName: isWahaConfigured() ? 'WAHA' : null,
        apiBaseUrl: env.WAHA_API_URL ?? null,
        senderId: getWahaSessionName(),
        phoneNumber: '(11) 99999-1000',
        isDefault: true,
      },
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'CREATE',
      entityType: 'communication_channel',
      entityId: channel.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      nextData: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        mode: channel.mode,
        status: channel.status,
      },
    })

    if (isWahaConfigured()) {
      const qr = await connectWahaSession()
      const updated = await prisma.communicationChannelConfig.update({
        where: { id: channel.id },
        data: {
          status: 'CONNECTING',
          qrToken: qr.base64 ?? qr.code,
          lastSyncAt: new Date(),
        },
      })

      response.status(201).json({ channel: updated, qrValue: qr.code, qrCodeBase64: qr.base64, evolutionConfigured: true })
      return
    }

    response.status(201).json({ channel, evolutionConfigured: false })
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

    if (isWahaConfigured()) {
      const qr = await connectWahaSession()
      const updated = await prisma.communicationChannelConfig.update({
        where: { id: channelId },
        data: {
          providerName: 'WAHA',
          apiBaseUrl: env.WAHA_API_URL,
          senderId: getWahaSessionName(),
          qrToken: qr.base64 ?? qr.code,
          status: 'CONNECTING',
          lastSyncAt: new Date(),
        },
      })

      response.json({
        channel: updated,
        qrValue: qr.code,
        qrCodeBase64: qr.base64,
        pairingCode: null,
        evolutionConfigured: true,
      })
      return
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
      qrCodeBase64: null,
      evolutionConfigured: false,
    })
  }),
)

communicationsRouter.post(
  '/channels/:id/disconnect',
  authorize('ADMIN'),
  asyncHandler(async (request, response) => {
    const channelId = String(request.params.id)
    const channel = await prisma.communicationChannelConfig.findFirst({
      where: {
        id: channelId,
        type: 'WHATSAPP',
        mode: 'QR',
      },
    })

    if (!channel) {
      throw new HttpError(404, 'Canal de WhatsApp QR nao encontrado.')
    }

    if (isWahaConfigured()) {
      await logoutWahaSession()
    }

    const updated = await prisma.communicationChannelConfig.update({
      where: { id: channelId },
      data: {
        status: 'DRAFT',
        qrToken: null,
        lastSyncAt: new Date(),
      },
    })

    await writeAuditLog({
      actorUserId: request.user!.id,
      action: 'UPDATE',
      entityType: 'communication_channel',
      entityId: channel.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      previousData: { status: channel.status },
      nextData: { status: updated.status },
    })

    response.json({ channel: updated })
  }),
)

communicationsRouter.post(
  '/campaigns',
  authorize('ADMIN', 'SUPERVISOR'),
  asyncHandler(async (request, response) => {
    const currentUser = request.user!
    const payload = campaignPayloadSchema.parse(request.body)
    const channel = await findWhatsAppQrChannel(payload.channelConfigId)

    if (!channel) {
      throw new HttpError(404, 'Canal de WhatsApp Business nao encontrado.')
    }

    if (!payload.saveAsDraft && !['CONNECTED', 'READY'].includes(channel.status)) {
      throw new HttpError(400, 'Conecte um numero do WhatsApp antes de criar uma campanha.')
    }

    if (payload.scheduledAt && new Date(payload.scheduledAt) <= new Date()) {
      throw new HttpError(400, 'Informe uma data futura para agendar a campanha.')
    }

    const audienceWhere = buildAudienceWhere(currentUser, payload)

    const audience = await prisma.supporter.findMany({
      where: audienceWhere,
      select: {
        id: true,
      },
    })

    if (!payload.saveAsDraft && audience.length === 0) {
      throw new HttpError(400, 'Nenhum apoiador encontrado para o publico selecionado.')
    }

    const campaign = await prisma.communicationCampaign.create({
      data: {
        title: payload.title,
        subject: payload.subject || null,
        body: payload.body,
        channelConfigId: channel.id,
        audienceType: payload.audienceType,
        city: payload.city || null,
        electoralZone: payload.electoralZone || null,
        leaderId: payload.leaderId || null,
        notifyAllBase: payload.notifyAllBase,
        status: payload.saveAsDraft ? 'DRAFT' : payload.scheduledAt ? 'SCHEDULED' : 'QUEUED',
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        createdByUserId: currentUser.id,
        recipients: {
          create: payload.saveAsDraft ? [] : audience.map((supporter) => ({
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

    if (campaign.status === 'QUEUED') {
      await dispatchImmediateWhatsAppCampaign(campaign.id, campaign.body)
    }

    const updatedCampaign = await prisma.communicationCampaign.findUnique({
      where: { id: campaign.id },
      include: {
        recipients: true,
        channelConfig: true,
      },
    })

    response.status(201).json({
      campaign: {
        id: updatedCampaign?.id ?? campaign.id,
        title: updatedCampaign?.title ?? campaign.title,
        status: updatedCampaign?.status ?? campaign.status,
        recipientsCount: updatedCampaign?.recipients.length ?? campaign.recipients.length,
        channelName: updatedCampaign?.channelConfig.name ?? campaign.channelConfig.name,
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
