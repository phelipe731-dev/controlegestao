import { env } from '../config/env.js'
import { HttpError } from '../utils/http-error.js'

type WahaResponse = Record<string, unknown>

export type WahaQrCode = {
  code: string | null
  base64: string | null
}

export type WahaConnectionStatus = 'working' | 'scan_qr' | 'starting' | 'stopped' | 'unknown'

const configured = Boolean(env.WAHA_API_URL && env.WAHA_API_KEY)

function buildUrl(path: string) {
  if (!env.WAHA_API_URL) {
    throw new HttpError(503, 'WAHA nao configurado.')
  }

  return `${env.WAHA_API_URL.replace(/\/$/, '')}${path}`
}

function safeJsonParse(text: string): WahaResponse {
  try {
    return JSON.parse(text) as WahaResponse
  } catch {
    return { raw: text }
  }
}

function extractMessage(data: WahaResponse) {
  const error = data.error
  if (typeof data.message === 'string') return data.message
  if (typeof error === 'string') return error
  return null
}

async function requestWaha(path: string, options: RequestInit = {}) {
  if (!configured || !env.WAHA_API_KEY) {
    throw new HttpError(503, 'WAHA nao configurado.')
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Key': env.WAHA_API_KEY,
      ...options.headers,
    },
  })

  const text = await response.text()
  const data = text ? safeJsonParse(text) : {}

  if (!response.ok) {
    const message = extractMessage(data) ?? `WAHA retornou HTTP ${response.status}.`
    throw new HttpError(response.status >= 500 ? 502 : response.status, message)
  }

  return data
}

function extractString(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
    if (value && typeof value === 'object') {
      const nested = extractString(value, keys)
      if (nested) return nested
    }
  }

  return null
}

function isMissingSession(error: unknown) {
  if (!(error instanceof HttpError)) return false
  const message = error.message.toLowerCase()
  return error.statusCode === 404 || message.includes('not found') || message.includes('session')
}

export function isWahaConfigured() {
  return configured
}

export function getWahaSessionName() {
  return env.WAHA_SESSION
}

export function normalizeWhatsAppNumber(phone?: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

export async function ensureWahaSession() {
  if (!configured) return

  try {
    await requestWaha(`/api/sessions/${encodeURIComponent(env.WAHA_SESSION)}`)
  } catch (error) {
    if (!isMissingSession(error)) throw error

    await requestWaha('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        name: env.WAHA_SESSION,
        config: {
          webhooks: [
            {
              url: env.WAHA_WEBHOOK_URL ?? `${env.FRONTEND_URL.replace(/\/$/, '')}/api/communications/webhook/waha`,
              events: ['message', 'session.status'],
              customHeaders: env.WAHA_WEBHOOK_SECRET ? [{ name: 'x-campanhahub-webhook-secret', value: env.WAHA_WEBHOOK_SECRET }] : [],
            },
          ],
        },
      }),
    })
  }

  await requestWaha(`/api/sessions/${encodeURIComponent(env.WAHA_SESSION)}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function connectWahaSession(): Promise<WahaQrCode> {
  await ensureWahaSession()

  const imageData = await requestWaha(`/api/${encodeURIComponent(env.WAHA_SESSION)}/auth/qr?format=image`, {
    headers: {
      Accept: 'application/json',
    },
  })

  const mimetype = extractString(imageData, ['mimetype']) ?? 'image/png'
  const data = extractString(imageData, ['data'])

  if (data) {
    return {
      code: null,
      base64: data.startsWith('data:image') ? data : `data:${mimetype};base64,${data}`,
    }
  }

  const rawData = await requestWaha(`/api/${encodeURIComponent(env.WAHA_SESSION)}/auth/qr?format=raw`)

  return {
    code: extractString(rawData, ['value']),
    base64: null,
  }
}

export async function getWahaConnectionStatus(): Promise<WahaConnectionStatus> {
  const data = await requestWaha(`/api/sessions/${encodeURIComponent(env.WAHA_SESSION)}`)
  const status = (extractString(data, ['status']) ?? '').toUpperCase()

  if (status === 'WORKING') return 'working'
  if (status === 'SCAN_QR' || status === 'SCAN_QR_CODE') return 'scan_qr'
  if (status === 'STARTING') return 'starting'
  if (status === 'STOPPED') return 'stopped'
  return 'unknown'
}

export async function logoutWahaSession() {
  await requestWaha(`/api/sessions/${encodeURIComponent(env.WAHA_SESSION)}/logout`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function sendWahaTextMessage(phone: string, text: string) {
  const number = normalizeWhatsAppNumber(phone)
  if (!number) {
    throw new HttpError(400, 'Telefone invalido para envio por WhatsApp.')
  }

  return requestWaha('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({
      chatId: `${number}@c.us`,
      text,
      session: env.WAHA_SESSION,
    }),
  })
}
