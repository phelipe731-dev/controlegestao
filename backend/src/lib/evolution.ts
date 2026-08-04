import { env } from '../config/env.js'
import { HttpError } from '../utils/http-error.js'

type EvolutionResponse = Record<string, unknown>

export type EvolutionQrCode = {
  code: string | null
  base64: string | null
  pairingCode: string | null
}

export type EvolutionConnectionStatus = 'open' | 'connecting' | 'close' | 'unknown'

const configured = Boolean(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY)

function buildUrl(path: string) {
  if (!env.EVOLUTION_API_URL) {
    throw new HttpError(503, 'Evolution API nao configurada.')
  }

  return `${env.EVOLUTION_API_URL.replace(/\/$/, '')}${path}`
}

async function requestEvolution(path: string, options: RequestInit = {}) {
  if (!configured || !env.EVOLUTION_API_KEY) {
    throw new HttpError(503, 'Evolution API nao configurada.')
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      apikey: env.EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const text = await response.text()
  const data = text ? safeJsonParse(text) : {}

  if (!response.ok) {
    const message = extractMessage(data) ?? `Evolution API retornou HTTP ${response.status}.`
    throw new HttpError(response.status >= 500 ? 502 : response.status, message)
  }

  return data
}

function safeJsonParse(text: string): EvolutionResponse {
  try {
    return JSON.parse(text) as EvolutionResponse
  } catch {
    return { raw: text }
  }
}

function extractMessage(data: EvolutionResponse) {
  const error = data.error
  if (typeof data.message === 'string') return data.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return null
}

function isAlreadyCreated(data: EvolutionResponse) {
  const message = (extractMessage(data) ?? '').toLowerCase()
  return message.includes('already') || message.includes('existe') || message.includes('exists')
}

function extractNestedString(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (value && typeof value === 'object') {
      const nested = extractNestedString(value, keys)
      if (nested) return nested
    }
  }

  return null
}

export function isEvolutionConfigured() {
  return configured
}

export function normalizeWhatsAppNumber(phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

export async function ensureEvolutionInstance() {
  if (!configured) return

  const webhookUrl = env.EVOLUTION_WEBHOOK_URL ?? `${env.FRONTEND_URL.replace(/\/$/, '')}/api/communications/webhook/evolution`

  try {
    await requestEvolution('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: env.EVOLUTION_INSTANCE_NAME,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          enabled: true,
          url: webhookUrl,
          events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'SEND_MESSAGE'],
          headers: env.EVOLUTION_WEBHOOK_SECRET ? { 'x-campanhahub-webhook-secret': env.EVOLUTION_WEBHOOK_SECRET } : {},
        },
      }),
    })
  } catch (error) {
    if (error instanceof HttpError && error.statusCode < 500) {
      const response = error.message ? { message: error.message } : {}
      if (isAlreadyCreated(response)) return
    }

    throw error
  }
}

export async function connectEvolutionInstance(): Promise<EvolutionQrCode> {
  await ensureEvolutionInstance()

  const data = await requestEvolution(`/instance/connect/${encodeURIComponent(env.EVOLUTION_INSTANCE_NAME)}`)

  return {
    code: extractNestedString(data, ['code', 'qrcode']) ?? null,
    base64: extractNestedString(data, ['base64']) ?? null,
    pairingCode: extractNestedString(data, ['pairingCode']) ?? null,
  }
}

export async function getEvolutionConnectionStatus(): Promise<EvolutionConnectionStatus> {
  const data = await requestEvolution(`/instance/connectionState/${encodeURIComponent(env.EVOLUTION_INSTANCE_NAME)}`)
  const state = (extractNestedString(data, ['state', 'instance', 'status']) ?? '').toLowerCase()

  if (['open', 'connected', 'ready'].includes(state)) return 'open'
  if (['connecting', 'pairing', 'qrcode'].includes(state)) return 'connecting'
  if (['close', 'closed', 'disconnected', 'logout'].includes(state)) return 'close'
  return 'unknown'
}

export async function logoutEvolutionInstance() {
  await requestEvolution(`/instance/logout/${encodeURIComponent(env.EVOLUTION_INSTANCE_NAME)}`, {
    method: 'DELETE',
  })
}

export async function sendEvolutionTextMessage(phone: string, text: string) {
  const number = normalizeWhatsAppNumber(phone)
  if (!number) {
    throw new HttpError(400, 'Telefone invalido para envio por WhatsApp.')
  }

  return requestEvolution(`/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE_NAME)}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      textMessage: {
        text,
      },
      delay: 800,
      linkPreview: false,
    }),
  })
}
