import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileUp,
  Link,
  Loader2,
  MessageCircle,
  MessageSquareMore,
  MoreVertical,
  Paperclip,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Smartphone,
  Trash2,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import { Field, SelectInput, TextAreaInput, TextInput } from '../components/FormControls'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { formatDateTime, statusLabel } from '../lib/format'
import type {
  CampaignAudienceType,
  CampaignStatus,
  CommunicationChannel,
  CommunicationChannelStatus,
  CommunicationCampaign,
  CommunicationsOverview,
  Leader,
} from '../types/api'

type CampaignFormState = {
  title: string
  objective: string
  body: string
  audienceMode: 'ALL' | 'SEGMENT' | 'MANUAL' | 'IMPORT'
  segmentType: 'CITY' | 'LEADER'
  city: string
  leaderId: string
  manualRecipients: string
  manualRecipientName: string
  manualRecipientPhone: string
  manualBulkText: string
  manualSearch: string
  manualStatusFilter: 'ALL' | 'VALID' | 'INVALID' | 'DUPLICATE'
  importFileName: string
  importError: string
  attachmentName: string
  attachmentSize: number
  scheduleMode: 'NOW' | 'SCHEDULE'
  scheduledAt: string
}

type PendingCampaignAction = 'draft' | 'send' | null

const initialCampaignForm: CampaignFormState = {
  title: '',
  objective: 'Informativo',
  body: '',
  audienceMode: 'ALL',
  segmentType: 'CITY',
  city: '',
  leaderId: '',
  manualRecipients: '',
  manualRecipientName: '',
  manualRecipientPhone: '',
  manualBulkText: '',
  manualSearch: '',
  manualStatusFilter: 'ALL',
  importFileName: '',
  importError: '',
  attachmentName: '',
  attachmentSize: 0,
  scheduleMode: 'NOW',
  scheduledAt: '',
}

const messageLimit = 1024
const campaignSteps = ['Conteúdo', 'Público', 'Envio', 'Revisão'] as const
const campaignObjectives = ['Informativo', 'Convite', 'Lembrete', 'Confirmação', 'Cobrança', 'Reativação', 'Personalizado']

const connectionLabels: Record<CommunicationChannelStatus | 'DISCONNECTED', string> = {
  DRAFT: 'Desconectado',
  CONNECTING: 'Aguardando leitura',
  CONNECTED: 'Conectado',
  READY: 'Conectado',
  ERROR: 'Erro na conexão',
  DISCONNECTED: 'Desconectado',
}

const connectionStyles: Record<CommunicationChannelStatus | 'DISCONNECTED', { card: string; icon: string; text: string; badge: string }> = {
  DRAFT: { card: 'bg-slate-100', icon: 'text-slate-500', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600' },
  CONNECTING: { card: 'bg-amber/10', icon: 'text-amber', text: 'text-amber', badge: 'bg-amber/10 text-amber' },
  CONNECTED: { card: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' },
  READY: { card: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' },
  ERROR: { card: 'bg-rose/10', icon: 'text-rose', text: 'text-rose', badge: 'bg-rose/10 text-rose' },
  DISCONNECTED: { card: 'bg-slate-100', icon: 'text-slate-500', text: 'text-slate-500', badge: 'bg-slate-100 text-slate-600' },
}

const campaignStatusClasses: Record<CampaignStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  QUEUED: 'bg-amber/10 text-amber',
  SCHEDULED: 'bg-blue-50 text-blue-700',
  SENT: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-rose/10 text-rose',
}

type ManualRecipientAnalysis = {
  id: string
  phone: string
  originalPhone: string
  name: string | null
  status: 'VALID' | 'INVALID' | 'DUPLICATE'
  origin: 'Manual' | 'Colado' | 'Arquivo'
  reason?: string
}

function normalizeBrazilPhone(value: string) {
  const raw = value.replace(/\D/g, '')
  if (!raw) return ''
  let digits = raw

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits.startsWith('55') && [10, 11].includes(digits.length)) digits = `55${digits}`

  return digits
}

function isValidBrazilPhone(value: string) {
  const digits = normalizeBrazilPhone(value)
  if (!/^55\d{10,11}$/.test(digits)) return false
  const ddd = Number(digits.slice(2, 4))
  return ddd >= 11 && ddd <= 99
}

function parseContactLine(line: string, origin: ManualRecipientAnalysis['origin'], index: number): ManualRecipientAnalysis | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/[;\t,]/).map((part) => part.trim()).filter(Boolean)
  const phonePart = parts.find((part) => part.replace(/\D/g, '').length >= 8) ?? trimmed
  const nameParts = parts.length > 1 ? parts.filter((part) => part !== phonePart) : [trimmed.replace(phonePart, '')]
  const normalizedPhone = normalizeBrazilPhone(phonePart)
  const name = nameParts.join(' ').replace(/\s+/g, ' ').trim()

  return {
    id: `${origin}-${index}-${normalizedPhone || trimmed}`,
    phone: normalizedPhone,
    originalPhone: phonePart,
    name: name || null,
    status: isValidBrazilPhone(phonePart) ? 'VALID' : 'INVALID',
    origin,
    reason: isValidBrazilPhone(phonePart) ? undefined : 'Telefone inválido',
  }
}

function analyzeManualRecipients(value: string) {
  const seen = new Set<string>()

  return value
    .split(/\r?\n/)
    .map((line, index) => parseContactLine(line, line.toLowerCase().includes('[arquivo]') ? 'Arquivo' : line.toLowerCase().includes('[colado]') ? 'Colado' : 'Manual', index))
    .filter((recipient): recipient is ManualRecipientAnalysis => Boolean(recipient))
    .map((recipient) => {
      if (recipient.status !== 'VALID') return recipient
      if (seen.has(recipient.phone)) {
        return { ...recipient, status: 'DUPLICATE' as const, reason: 'Duplicado na campanha' }
      }
      seen.add(recipient.phone)
      return recipient
    })
}

function parseManualRecipients(value: string) {
  return analyzeManualRecipients(value)
    .filter((recipient) => recipient.status === 'VALID')
    .map((recipient) => ({ phone: recipient.phone, name: recipient.name }))
}

function formatManualRecipientLine(phone: string, name?: string | null, origin: ManualRecipientAnalysis['origin'] = 'Manual') {
  const prefix = origin === 'Manual' ? '' : `[${origin}] `
  return `${prefix}${[name?.trim(), phone.replace(/\D/g, '')].filter(Boolean).join('; ')}`
}

function formatPhoneDisplay(value?: string | null) {
  if (!value) return 'Número não conectado'
  const digits = value.replace(/\D/g, '')
  const national = digits.startsWith('55') ? digits.slice(2) : digits
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`
  return value
}

function currencyNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string
  value: string | number
  helper?: string
  icon: ComponentType<{ className?: string }>
  tone: string
}) {
  return (
    <div className="app-card flex min-h-[104px] items-center gap-4 p-5">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-500">{title}</div>
        <div className="mt-1 truncate font-display text-3xl font-bold text-ink">{value}</div>
        {helper ? <div className="mt-1 text-xs text-slate-400">{helper}</div> : null}
      </div>
    </div>
  )
}

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${campaignStatusClasses[status]}`}>
      {statusLabel(status)}
    </span>
  )
}

function WhatsAppQrPreview({ token }: { token?: string | null }) {
  if (token?.startsWith('data:image')) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <img src={token} alt="QR Code do WhatsApp Business" className="aspect-square w-full rounded-lg object-contain" />
      </div>
    )
  }

  const seed = token || 'WHATSAPP-BUSINESS-QR'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-9 gap-1">
        {Array.from({ length: 81 }).map((_, index) => {
          const code = seed.charCodeAt(index % seed.length)
          const active = (code + index * 7) % 4 !== 0
          return <div key={index} className={`aspect-square rounded-[3px] ${active ? 'bg-ink' : 'bg-slate-100'}`} />
        })}
      </div>
      <div className="mt-3 flex justify-center">
        <span className="rounded-full bg-white px-2 py-1 text-xl shadow-sm">☎</span>
      </div>
    </div>
  )
}

function WhatsAppQrModal({
  open,
  channel,
  evolutionConfigured,
  refreshing,
  onRefresh,
  onClose,
}: {
  open: boolean
  channel?: CommunicationChannel
  evolutionConfigured: boolean
  refreshing: boolean
  onRefresh: () => void
  onClose: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  const status = channel?.status ?? 'DISCONNECTED'
  const style = connectionStyles[status]
  const isConnected = ['CONNECTED', 'READY'].includes(status)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    window.setTimeout(() => modalRef.current?.focus(), 0)

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Fechar QR Code" onClick={onClose} />
      <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Conectar WhatsApp Business" className="app-card relative z-10 w-full max-w-3xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">{isConnected ? 'WhatsApp Business conectado' : 'Conectar WhatsApp Business'}</h3>
            <p className="mt-1 text-sm text-slate-500">{isConnected ? 'Sessão pronta para envio de campanhas.' : 'Escaneie o QR Code com o WhatsApp do número que será utilizado.'}</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink" aria-label="Fechar modal" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[240px,1fr]">
          <div>
            {isConnected ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-8 text-center text-emerald-700 shadow-sm">
                <CheckCircle2 className="mx-auto h-16 w-16" />
                <div className="mt-4 font-display text-xl font-bold">Conectado</div>
                <div className="mt-1 text-sm">{channel?.phoneNumber ?? channel?.senderId ?? 'WhatsApp pronto'}</div>
              </div>
            ) : (
              <WhatsAppQrPreview token={channel?.qrToken} />
            )}
            <div className={`mx-auto mt-3 w-fit rounded-lg px-3 py-1.5 text-xs font-semibold ${style.badge}`}>
              {refreshing ? 'Gerando QR Code' : connectionLabels[status]}
            </div>
          </div>
          <div className="space-y-4 self-center">
            {['Abra o WhatsApp no celular', 'Vá em Aparelhos conectados', 'Toque em Conectar aparelho', 'Escaneie o QR Code'].map((item, index) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">{index + 1}</span>
                {item}
              </div>
            ))}
            {evolutionConfigured ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                QR Code gerado pelo WAHA. A tela atualiza o status automaticamente enquanto o modal estiver aberto.
              </div>
            ) : (
              <div className="rounded-xl border border-amber/20 bg-amber/10 p-3 text-xs text-amber">
                Configure WAHA_API_URL e WAHA_API_KEY no backend para gerar um QR Code escaneável.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 p-5">
          {isConnected ? (
            <button type="button" className="button-primary" onClick={onClose}>
              <CheckCircle2 className="h-4 w-4" />
              Conectado
            </button>
          ) : (
            <button type="button" className="button-secondary" disabled={refreshing} onClick={onRefresh}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar QR
            </button>
          )}
          <button type="button" className="button-secondary" onClick={onClose}>
            {isConnected ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WhatsAppConnectionCard({
  channel,
  evolutionConfigured,
  refreshing,
  disconnecting,
  onConnect,
  onDisconnect,
}: {
  channel?: CommunicationChannel
  evolutionConfigured: boolean
  refreshing: boolean
  disconnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const status = channel?.status ?? 'DISCONNECTED'
  const isConnected = ['CONNECTED', 'READY'].includes(status)
  const style = connectionStyles[status]
  const number = formatPhoneDisplay(channel?.phoneNumber || channel?.senderId)

  return (
    <section className="app-card p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">WhatsApp Business QR</h3>
          <p className="mt-1 text-sm text-slate-500">Canal único de envio</p>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-ink">{number}</div>
              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>{connectionLabels[status]}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Última sincronização: {formatDateTime(channel?.lastSyncAt)}
            </span>
            <span>Sessão: {channel?.name ?? 'WhatsApp Business QR'}</span>
            <span>Integração: {evolutionConfigured ? 'WAHA configurado' : 'Aguardando configuração'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          {!isConnected ? (
            <button type="button" className="button-primary justify-center" disabled={refreshing} onClick={onConnect}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              {status === 'CONNECTING' ? 'Abrir QR Code' : 'Conectar WhatsApp'}
            </button>
          ) : (
            <>
              <button type="button" className="button-secondary justify-center" disabled={refreshing} onClick={onConnect}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reconectar
              </button>
              <button type="button" className="button-danger justify-center" disabled={disconnecting} onClick={onDisconnect}>
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />}
                Desconectar
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function RecentCampaigns({
  campaigns,
  onCreate,
}: {
  campaigns: CommunicationCampaign[]
  onCreate: () => void
}) {
  if (campaigns.length === 0) {
    return (
      <section className="app-card p-8 text-center">
        <Send className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-3 font-display text-lg font-bold text-ink">Nenhuma campanha criada</h3>
        <p className="mt-1 text-sm text-slate-500">Crie sua primeira campanha de WhatsApp para se comunicar com sua base.</p>
        <button type="button" className="button-primary mt-4" onClick={onCreate}>
          Criar primeira campanha
        </button>
      </section>
    )
  }

  return (
    <section className="app-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Disparos recentes</h3>
          <p className="mt-1 text-sm text-slate-500">Últimas campanhas criadas para WhatsApp.</p>
        </div>
        <button type="button" className="button-primary text-xs" onClick={onCreate}>
          <Send className="h-4 w-4" />
          Criar campanha
        </button>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Campanha</th>
              <th>Público</th>
              <th>Agendada/enviada em</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <div className="font-semibold text-ink">{campaign.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">Criada em {formatDateTime(campaign.createdAt)}</div>
                </td>
                <td>
                  <div>{statusLabel(campaign.audienceType)}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{campaign.recipientsCount} destinatários</div>
                </td>
                <td>{campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : campaign.sentAt ? formatDateTime(campaign.sentAt) : 'Envio imediato'}</td>
                <td><CampaignStatusBadge status={campaign.status} /></td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button type="button" className="button-ghost px-2.5 py-1.5" aria-label="Visualizar campanha">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" className="button-ghost px-2.5 py-1.5" aria-label="Duplicar campanha">
                      <Copy className="h-4 w-4" />
                    </button>
                    <button type="button" className="button-ghost px-2.5 py-1.5" aria-label="Mais ações">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-4 lg:hidden">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-ink">{campaign.title}</div>
                <div className="mt-1 text-xs text-slate-500">{statusLabel(campaign.audienceType)} · {campaign.recipientsCount} destinatários</div>
              </div>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <div className="mt-3 text-sm text-slate-500">{campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : 'Envio imediato'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function RadioCard({
  active,
  title,
  description,
  children,
  onClick,
}: {
  active: boolean
  title: string
  description: string
  children?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`rounded-xl border p-4 text-left transition ${active ? 'border-teal bg-teal/5 ring-2 ring-teal/10' : 'border-slate-200 bg-white hover:border-teal/40'}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 h-4 w-4 rounded-full border ${active ? 'border-teal bg-teal shadow-[inset_0_0_0_4px_white]' : 'border-slate-300'}`} />
        <span>
          <span className="block font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-sm text-slate-500">{description}</span>
          {children}
        </span>
      </div>
    </button>
  )
}

function NewCampaignForm({
  form,
  leaders,
  estimate,
  channel,
  connected,
  evolutionConfigured,
  submitting,
  onChange,
  onSubmit,
  onOpenQr,
}: {
  form: CampaignFormState
  leaders: Leader[]
  estimate?: number
  channel?: CommunicationChannel
  connected: boolean
  evolutionConfigured: boolean
  submitting: boolean
  onChange: (form: CampaignFormState) => void
  onSubmit: (action: Exclude<PendingCampaignAction, null>) => void
  onOpenQr: () => void
}) {
  const [step, setStep] = useState(0)
  const [testOpen, setTestOpen] = useState(false)
  const [testName, setTestName] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const importInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const charsLeft = messageLimit - form.body.length
  const isScheduled = form.scheduleMode === 'SCHEDULE'
  const manualRecipientRows = analyzeManualRecipients(form.manualRecipients)
  const validManualRecipients = manualRecipientRows.filter((recipient) => recipient.status === 'VALID')
  const invalidManualRecipients = manualRecipientRows.filter((recipient) => recipient.status === 'INVALID')
  const duplicateManualRecipients = manualRecipientRows.filter((recipient) => recipient.status === 'DUPLICATE')
  const manualRecipientsCount = validManualRecipients.length
  const audienceTotal = form.audienceMode === 'MANUAL' || form.audienceMode === 'IMPORT' ? manualRecipientsCount : estimate ?? 0
  const connectedNumber = formatPhoneDisplay(channel?.phoneNumber || channel?.senderId)
  const filteredManualRecipients = manualRecipientRows.filter((recipient) => {
    const matchesStatus = form.manualStatusFilter === 'ALL' || recipient.status === form.manualStatusFilter
    const search = form.manualSearch.trim().toLowerCase()
    const matchesSearch = !search || `${recipient.name ?? ''} ${recipient.phone} ${recipient.originalPhone}`.toLowerCase().includes(search)
    return matchesStatus && matchesSearch
  })

  const sendTestMutation = useMutation({
    mutationFn: async () => api.post('/communications/test-message', {
      phone: testPhone,
      name: testName || null,
      body: previewBody(testName || 'Contato de teste'),
    }),
    onSuccess: () => {
      alert('Mensagem de teste enviada com sucesso.')
      setTestOpen(false)
      setTestName('')
      setTestPhone('')
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  function previewBody(name = 'Maria') {
    return (form.body || 'Sua mensagem aparecerá aqui.')
      .replace(/\{\{nome\}\}/g, name)
      .replace(/\{\{telefone\}\}/g, '(13) 99999-9999')
      .replace(/\{\{cidade\}\}/g, 'Santos')
      .replace(/\{\{bairro\}\}/g, 'Gonzaga')
  }

  function addManualRecipient() {
    const phone = form.manualRecipientPhone.replace(/\D/g, '')
    const name = form.manualRecipientName.trim()

    if (!isValidBrazilPhone(phone)) {
      alert('Informe um telefone válido com DDD.')
      return
    }

    if (validManualRecipients.some((recipient) => recipient.phone === normalizeBrazilPhone(phone))) {
      alert('Este telefone já está na lista.')
      return
    }

    onChange({
      ...form,
      manualRecipients: [...form.manualRecipients.split(/\r?\n/).filter(Boolean), formatManualRecipientLine(phone, name)].join('\n'),
      manualRecipientName: '',
      manualRecipientPhone: '',
    })
  }

  function removeManualRecipient(phone: string) {
    onChange({
      ...form,
      manualRecipients: manualRecipientRows
        .filter((recipient) => recipient.phone !== phone)
        .map((recipient) => formatManualRecipientLine(recipient.originalPhone || recipient.phone, recipient.name, recipient.origin))
        .join('\n'),
    })
  }

  function processBulkContacts() {
    const parsed = form.manualBulkText
      .split(/\r?\n/)
      .map((line, index) => parseContactLine(line, 'Colado', index))
      .filter((recipient): recipient is ManualRecipientAnalysis => Boolean(recipient))

    if (parsed.length === 0) {
      alert('Cole ao menos um telefone para processar.')
      return
    }

    onChange({
      ...form,
      audienceMode: 'MANUAL',
      manualRecipients: [
        ...form.manualRecipients.split(/\r?\n/).filter(Boolean),
        ...parsed.map((recipient) => formatManualRecipientLine(recipient.originalPhone || recipient.phone, recipient.name, 'Colado')),
      ].join('\n'),
      manualBulkText: '',
    })
    setBulkOpen(false)
  }

  async function importContacts(file?: File) {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'txt'].includes(extension ?? '')) {
      onChange({ ...form, audienceMode: 'IMPORT', importFileName: file.name, importError: 'Importação XLSX será habilitada no backend seguro. Por enquanto, exporte a planilha como CSV.' })
      return
    }

    const text = await file.text()
    const rows = text.split(/\r?\n/).filter(Boolean)
    const usableRows = rows[0]?.toLowerCase().includes('telefone') ? rows.slice(1) : rows

    const importedRows = usableRows
      .map((line, index) => parseContactLine(line, 'Arquivo', index))
      .filter((recipient): recipient is ManualRecipientAnalysis => Boolean(recipient))

    onChange({
      ...form,
      audienceMode: 'IMPORT',
      importFileName: file.name,
      importError: '',
      manualRecipients: [
        ...form.manualRecipients.split(/\r?\n/).filter(Boolean),
        ...importedRows.map((recipient) => formatManualRecipientLine(recipient.originalPhone || recipient.phone, recipient.name, 'Arquivo')),
      ].join('\n'),
    })
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (form.title.trim().length < 3) return 'Informe o nome da campanha.'
      if (form.body.trim().length < 10) return 'Digite a mensagem da campanha.'
    }
    if (step === 1) {
      if ((form.audienceMode === 'MANUAL' || form.audienceMode === 'IMPORT') && manualRecipientsCount === 0) return 'Informe ao menos um telefone válido.'
      if (form.audienceMode === 'SEGMENT' && form.segmentType === 'CITY' && !form.city.trim()) return 'Informe a cidade do segmento.'
      if (form.audienceMode === 'SEGMENT' && form.segmentType === 'LEADER' && !form.leaderId) return 'Selecione o líder do segmento.'
    }
    if (step === 2 && form.scheduleMode === 'SCHEDULE') {
      if (!form.scheduledAt) return 'Informe data e horário para agendar.'
      if (new Date(form.scheduledAt) <= new Date()) return 'Escolha uma data futura para agendar.'
    }
    return null
  }

  function goNext() {
    const error = validateCurrentStep()
    if (error) {
      alert(error)
      return
    }
    setStep((current) => Math.min(current + 1, campaignSteps.length - 1))
  }

  return (
    <section className="app-card flex max-h-[92vh] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pr-10">
          <div>
            <h3 className="font-display text-2xl font-bold text-ink">Nova campanha</h3>
            <p className="mt-1 text-sm text-slate-500">Crie uma comunicação para toda a base ou para um público específico.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${connected ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber/20 bg-amber/10 text-amber'}`}>
              <MessageCircle className="h-4 w-4" />
              Número conectado: {connected ? connectedNumber : 'nenhum'} · {connected ? 'Conectado' : 'Desconectado'}
            </div>
            <button type="button" className="button-secondary" disabled={submitting} onClick={() => onSubmit('draft')}>
              Salvar rascunho
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-2 md:grid-cols-4">
          {campaignSteps.map((label, index) => (
            <button
              key={label}
              type="button"
              className={`flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-semibold transition ${step === index ? 'border-teal text-teal' : index < step ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500'}`}
              onClick={() => setStep(index)}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === index ? 'bg-teal text-white' : index < step ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
              {label}
            </button>
          ))}
        </div>

        {!evolutionConfigured ? (
          <div className="mt-4 rounded-xl border border-amber/20 bg-amber/10 p-4 text-sm text-amber">
            O WAHA ainda nao foi configurado no servidor. Voce pode preparar rascunhos, mas o envio real sera liberado depois da configuracao.
          </div>
        ) : !connected ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/20 bg-amber/10 p-4 text-sm text-amber">
            <span>Conecte um número do WhatsApp antes de confirmar uma campanha.</span>
            <button type="button" className="button-secondary text-xs" onClick={onOpenQr}>
              <QrCode className="h-4 w-4" />
              Conectar WhatsApp
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
          <div className="space-y-5">
            {step === 0 ? (
              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[1fr,260px]">
                  <Field label="Nome da campanha *">
                    <TextInput value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="Ex.: Convite para encontro regional" />
                  </Field>
                  <Field label="Objetivo">
                    <SelectInput value={form.objective} onChange={(event) => onChange({ ...form, objective: event.target.value })}>
                      {campaignObjectives.map((objective) => <option key={objective}>{objective}</option>)}
                    </SelectInput>
                  </Field>
                </div>

                <Field label="Mensagem *">
                  <TextAreaInput
                    value={form.body}
                    onChange={(event) => onChange({ ...form, body: event.target.value.slice(0, messageLimit) })}
                    placeholder="Digite a mensagem que será enviada pelo WhatsApp."
                    className="min-h-56"
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="button-secondary text-xs" onClick={() => onChange({ ...form, body: `${form.body} 😊`.slice(0, messageLimit) })}><Smile className="h-4 w-4" /> Emoji</button>
                    <button type="button" className="button-secondary text-xs" onClick={() => onChange({ ...form, body: `${form.body} {{nome}}`.slice(0, messageLimit) })}>{'{}'} Variável</button>
                    <button type="button" className="button-secondary text-xs" onClick={() => onChange({ ...form, body: `${form.body} https://`.slice(0, messageLimit) })}><Link className="h-4 w-4" /> Link</button>
                    <button type="button" className="button-secondary text-xs" onClick={() => attachmentInputRef.current?.click()}><Paperclip className="h-4 w-4" /> Anexo</button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        if (file.size > 10 * 1024 * 1024) {
                          alert('Anexo acima de 10MB. Escolha um arquivo menor.')
                          return
                        }
                        onChange({ ...form, attachmentName: file.name, attachmentSize: file.size })
                      }}
                    />
                  </div>
                  <div className={`text-xs ${charsLeft < 80 ? 'text-amber' : 'text-slate-400'}`}>{form.body.length}/{messageLimit}</div>
                </div>

                {form.attachmentName ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="min-w-0">
                      <div className="section-label">Anexo preparado</div>
                      <div className="mt-1 truncate text-sm font-semibold text-ink">{form.attachmentName}</div>
                      <div className="text-xs text-slate-500">{Math.ceil(form.attachmentSize / 1024)} KB · upload real será habilitado quando existir endpoint de mídia</div>
                    </div>
                    <button type="button" className="button-ghost text-rose" onClick={() => onChange({ ...form, attachmentName: '', attachmentSize: 0 })}>
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </div>
                ) : null}

                <button type="button" className="button-secondary" disabled={!connected || !evolutionConfigured} onClick={() => setTestOpen(true)}>
                  <Send className="h-4 w-4" />
                  Enviar teste
                </button>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <RadioCard active={form.audienceMode === 'ALL'} title="Toda a base" description="Enviar para todos os contatos aptos." onClick={() => onChange({ ...form, audienceMode: 'ALL' })} />
                  <RadioCard active={form.audienceMode === 'SEGMENT'} title="Segmento específico" description="Filtre por cidade ou líder." onClick={() => onChange({ ...form, audienceMode: 'SEGMENT' })} />
                  <RadioCard active={form.audienceMode === 'MANUAL'} title="Lista manual" description="Adicione, cole ou digite contatos." onClick={() => onChange({ ...form, audienceMode: 'MANUAL' })} />
                  <RadioCard active={form.audienceMode === 'IMPORT'} title="Importar arquivo" description="Importe contatos por CSV." onClick={() => onChange({ ...form, audienceMode: 'IMPORT' })} />
                </div>

                {form.audienceMode === 'ALL' ? (
                  <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatMini label="Contatos cadastrados" value={overviewSafeNumber(estimate)} />
                    <StatMini label="Telefones válidos" value={overviewSafeNumber(estimate)} />
                    <StatMini label="Duplicados removidos" value="0" />
                    <StatMini label="Público final" value={overviewSafeNumber(estimate)} highlight />
                  </div>
                ) : null}

                {form.audienceMode === 'SEGMENT' ? (
                  <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
                    <Field label="Filtro">
                      <SelectInput value={form.segmentType} onChange={(event) => onChange({ ...form, segmentType: event.target.value as CampaignFormState['segmentType'] })}>
                        <option value="CITY">Cidade</option>
                        <option value="LEADER">Líder</option>
                      </SelectInput>
                    </Field>
                    {form.segmentType === 'CITY' ? (
                      <Field label="Cidade">
                        <TextInput value={form.city} onChange={(event) => onChange({ ...form, city: event.target.value })} placeholder="Ex.: Santos" />
                      </Field>
                    ) : (
                      <Field label="Líder">
                        <SelectInput value={form.leaderId} onChange={(event) => onChange({ ...form, leaderId: event.target.value })}>
                          <option value="">Selecione</option>
                          {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
                        </SelectInput>
                      </Field>
                    )}
                  </div>
                ) : null}

                {form.audienceMode === 'MANUAL' || form.audienceMode === 'IMPORT' ? (
                  <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr,220px,auto]">
                      <Field label="Nome">
                        <TextInput value={form.manualRecipientName} onChange={(event) => onChange({ ...form, manualRecipientName: event.target.value })} placeholder="Ex.: Maria Silva" />
                      </Field>
                      <Field label="Telefone">
                        <TextInput value={form.manualRecipientPhone} onChange={(event) => onChange({ ...form, manualRecipientPhone: event.target.value })} placeholder="(13) 99999-9999" />
                      </Field>
                      <div className="flex items-end">
                        <button type="button" className="button-primary min-h-[44px] w-full justify-center md:w-auto" onClick={addManualRecipient}>
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="button-secondary text-xs" onClick={() => setBulkOpen(true)}>Colar lista</button>
                      <button type="button" className="button-secondary text-xs" onClick={() => importInputRef.current?.click()}><FileUp className="h-4 w-4" /> Importar CSV</button>
                      <button type="button" className="button-ghost text-xs" onClick={() => {
                        const csv = 'Nome,Telefone\nMaria Silva,13999999999\nJoao Santos,13988888888'
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const anchor = document.createElement('a')
                        anchor.href = url
                        anchor.download = 'modelo-contatos-campanha.csv'
                        anchor.click()
                        URL.revokeObjectURL(url)
                      }}>Baixar modelo</button>
                      <input ref={importInputRef} className="hidden" type="file" accept=".csv,.txt,.xlsx" onChange={(event) => void importContacts(event.target.files?.[0])} />
                    </div>

                    {form.importFileName ? (
                      <div className={`rounded-xl border p-3 text-sm ${form.importError ? 'border-amber/20 bg-amber/10 text-amber' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                        Arquivo: <strong>{form.importFileName}</strong>{form.importError ? ` · ${form.importError}` : ' · contatos processados e adicionados à lista.'}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-[1fr,180px]">
                      <Field label="Buscar contato">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <TextInput className="pl-9" value={form.manualSearch} onChange={(event) => onChange({ ...form, manualSearch: event.target.value })} placeholder="Nome ou telefone" />
                        </div>
                      </Field>
                      <Field label="Status">
                        <SelectInput value={form.manualStatusFilter} onChange={(event) => onChange({ ...form, manualStatusFilter: event.target.value as CampaignFormState['manualStatusFilter'] })}>
                          <option value="ALL">Todos</option>
                          <option value="VALID">Válidos</option>
                          <option value="INVALID">Inválidos</option>
                          <option value="DUPLICATE">Duplicados</option>
                        </SelectInput>
                      </Field>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="grid grid-cols-[1fr,150px,110px,100px,80px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 max-lg:hidden">
                        <span>Nome</span><span>Telefone</span><span>Status</span><span>Origem</span><span className="text-right">Ações</span>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {filteredManualRecipients.length === 0 ? (
                          <div className="p-4 text-sm text-slate-500">Nenhum contato na lista.</div>
                        ) : filteredManualRecipients.slice(0, 80).map((recipient) => (
                          <div key={recipient.id} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 lg:grid-cols-[1fr,150px,110px,100px,80px] lg:items-center">
                            <div className="font-semibold text-ink">{recipient.name || 'Sem nome'}</div>
                            <div className="text-slate-600">{formatPhoneDisplay(recipient.phone || recipient.originalPhone)}</div>
                            <ContactStatusBadge status={recipient.status} />
                            <div className="text-xs text-slate-500">{recipient.origin}</div>
                            <button type="button" className="button-ghost justify-self-start px-2.5 py-1.5 text-rose lg:justify-self-end" onClick={() => removeManualRecipient(recipient.phone)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <RadioCard active={form.scheduleMode === 'NOW'} title="Enviar agora" description="Preparar a campanha para envio imediato." onClick={() => onChange({ ...form, scheduleMode: 'NOW', scheduledAt: '' })} />
                <RadioCard active={form.scheduleMode === 'SCHEDULE'} title="Agendar envio" description="Escolha data e horário para disparar." onClick={() => onChange({ ...form, scheduleMode: 'SCHEDULE' })} />
                {isScheduled ? (
                  <Field label="Agendar para">
                    <TextInput type="datetime-local" value={form.scheduledAt} onChange={(event) => onChange({ ...form, scheduledAt: event.target.value })} />
                  </Field>
                ) : null}
                <details className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <summary className="cursor-pointer font-semibold text-ink">Configurações de envio</summary>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-teal" /> Pausar se o WhatsApp desconectar</label>
                    <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-teal" /> Retentar falhas temporárias</label>
                    <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-teal" /> Respeitar horário operacional</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="accent-teal" /> Interromper manualmente se necessário</label>
                  </div>
                </details>
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                  O horário de envio respeita o fuso horário America/Sao_Paulo (UTC-3).
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <CampaignReview
                form={form}
                channel={channel}
                connected={connected}
                audienceTotal={audienceTotal}
                validCount={validManualRecipients.length}
                invalidCount={invalidManualRecipients.length}
                duplicateCount={duplicateManualRecipients.length}
              />
            ) : null}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
            <button type="button" className="button-secondary w-full justify-center xl:hidden" onClick={() => setShowPreview((current) => !current)}>
              {showPreview ? 'Ocultar pré-visualização' : 'Mostrar pré-visualização'}
            </button>
            {showPreview ? (
              <>
                <CampaignPreview body={previewBody()} phone={connected ? connectedNumber : '(13) 99999-9999'} attachmentName={form.attachmentName} />
                <AudienceSummaryCard
                  source={form.audienceMode}
                  total={manualRecipientRows.length}
                  valid={form.audienceMode === 'MANUAL' || form.audienceMode === 'IMPORT' ? validManualRecipients.length : audienceTotal}
                  invalid={invalidManualRecipients.length}
                  duplicate={duplicateManualRecipients.length}
                  finalTotal={audienceTotal}
                  importFileName={form.importFileName}
                />
              </>
            ) : null}
          </aside>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white p-5">
        <button type="button" className="button-secondary min-h-[44px]" onClick={() => step === 0 ? onSubmit('draft') : setStep((current) => Math.max(current - 1, 0))}>
          {step === 0 ? 'Salvar rascunho' : <><ArrowLeft className="h-4 w-4" /> Voltar</>}
        </button>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="button-secondary min-h-[44px]" disabled={submitting} onClick={() => onSubmit('draft')}>
            Salvar rascunho
          </button>
          {step < campaignSteps.length - 1 ? (
            <button type="button" className="button-primary min-h-[44px]" onClick={goNext}>
              {step === 2 ? 'Revisar campanha' : 'Continuar'}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="button-primary min-h-[44px]" disabled={submitting || !connected || !evolutionConfigured} onClick={() => onSubmit('send')}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {form.scheduleMode === 'SCHEDULE' ? 'Confirmar agendamento' : 'Confirmar e enviar'}
            </button>
          )}
        </div>
      </div>

      {bulkOpen ? (
        <SmallModal title="Colar lista de contatos" onClose={() => setBulkOpen(false)}>
          <Field label="Cole um contato por linha">
            <TextAreaInput
              value={form.manualBulkText}
              onChange={(event) => onChange({ ...form, manualBulkText: event.target.value })}
              placeholder={'Maria Silva; 13999999999\nJoão Santos; 13988888888\n13977777777'}
              className="min-h-52"
            />
          </Field>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setBulkOpen(false)}>Cancelar</button>
            <button type="button" className="button-primary" onClick={processBulkContacts}>Processar contatos</button>
          </div>
        </SmallModal>
      ) : null}

      {testOpen ? (
        <SmallModal title="Enviar mensagem de teste" onClose={() => setTestOpen(false)}>
          <div className="grid gap-4">
            <Field label="Nome para teste">
              <TextInput value={testName} onChange={(event) => setTestName(event.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Telefone para teste *">
              <TextInput value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="(13) 99999-9999" />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setTestOpen(false)}>Cancelar</button>
            <button
              type="button"
              className="button-primary"
              disabled={sendTestMutation.isPending}
              onClick={() => {
                if (!isValidBrazilPhone(testPhone)) {
                  alert('Informe um telefone válido com DDD.')
                  return
                }
                sendTestMutation.mutate()
              }}
            >
              {sendTestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar teste
            </button>
          </div>
        </SmallModal>
      ) : null}
    </section>
  )
}

function overviewSafeNumber(value?: number) {
  return value === undefined ? 'calculando...' : currencyNumber(value)
}

function StatMini({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-teal/20 bg-teal/5 text-teal' : 'border-slate-100 bg-white text-slate-600'}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  )
}

function ContactStatusBadge({ status }: { status: ManualRecipientAnalysis['status'] }) {
  const styles = {
    VALID: 'bg-emerald-50 text-emerald-700',
    INVALID: 'bg-rose/10 text-rose',
    DUPLICATE: 'bg-amber/10 text-amber',
  }
  const labels = {
    VALID: 'Válido',
    INVALID: 'Inválido',
    DUPLICATE: 'Duplicado',
  }
  return <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>
}

function CampaignPreview({ body, phone, attachmentName }: { body: string; phone: string; attachmentName: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg font-bold text-ink">Pré-visualização</h4>
        <span className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500">Preview</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-[#efe7dc]">
        <div className="flex items-center gap-3 bg-teal px-4 py-3 text-white">
          <ArrowLeft className="h-4 w-4" />
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-teal">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold">{phone}</div>
            <div className="text-xs text-white/80">Conta comercial</div>
          </div>
        </div>
        <div className="p-4">
          <div className="ml-auto max-w-[88%] rounded-2xl bg-[#d8fdd2] px-4 py-3 text-sm text-slate-700 shadow-sm">
            {attachmentName ? (
              <div className="mb-3 rounded-xl border border-emerald-100 bg-white/60 p-3 text-xs font-semibold text-ink">
                <Paperclip className="mb-1 h-4 w-4" />
                {attachmentName}
              </div>
            ) : null}
            <div className="whitespace-pre-line">{body}</div>
            <div className="mt-2 text-right text-[10px] text-slate-500">09:41 ✓✓</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AudienceSummaryCard({
  source,
  total,
  valid,
  invalid,
  duplicate,
  finalTotal,
  importFileName,
}: {
  source: CampaignFormState['audienceMode']
  total: number
  valid: number
  invalid: number
  duplicate: number
  finalTotal: number
  importFileName: string
}) {
  const sourceLabel = source === 'ALL' ? 'Toda a base' : source === 'SEGMENT' ? 'Segmento específico' : source === 'IMPORT' ? 'Arquivo importado' : 'Lista manual'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <h4 className="font-display text-lg font-bold text-ink">Resumo do público</h4>
      <div className="mt-4 space-y-3 text-sm text-slate-600">
        <SummaryLine label="Fonte" value={sourceLabel} />
        {importFileName ? <SummaryLine label="Arquivo" value={importFileName} /> : null}
        <SummaryLine label="Total analisado" value={currencyNumber(total || finalTotal)} />
        <SummaryLine label="Válidos" value={currencyNumber(valid)} />
        <SummaryLine label="Inválidos" value={currencyNumber(invalid)} />
        <SummaryLine label="Duplicados" value={currencyNumber(duplicate)} />
        <div className="rounded-xl border border-teal/20 bg-teal/5 p-3 font-semibold text-teal">
          Público final: {currencyNumber(finalTotal)} contatos
        </div>
      </div>
    </section>
  )
}

function SummaryLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <strong className="text-right text-ink">{value}</strong>
    </div>
  )
}

function CampaignReview({
  form,
  channel,
  connected,
  audienceTotal,
  validCount,
  invalidCount,
  duplicateCount,
}: {
  form: CampaignFormState
  channel?: CommunicationChannel
  connected: boolean
  audienceTotal: number
  validCount: number
  invalidCount: number
  duplicateCount: number
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewBlock title="Campanha">
          <SummaryLine label="Nome" value={form.title || 'Não informado'} />
          <SummaryLine label="Objetivo" value={form.objective} />
        </ReviewBlock>
        <ReviewBlock title="WhatsApp">
          <SummaryLine label="Número" value={formatPhoneDisplay(channel?.phoneNumber || channel?.senderId)} />
          <SummaryLine label="Status" value={connected ? 'Conectado' : 'Desconectado'} />
          <SummaryLine label="Última sincronização" value={formatDateTime(channel?.lastSyncAt)} />
        </ReviewBlock>
        <ReviewBlock title="Público">
          <SummaryLine label="Público final" value={`${currencyNumber(audienceTotal)} contatos`} />
          <SummaryLine label="Válidos manuais" value={currencyNumber(validCount)} />
          <SummaryLine label="Inválidos removidos" value={currencyNumber(invalidCount)} />
          <SummaryLine label="Duplicados ignorados" value={currencyNumber(duplicateCount)} />
        </ReviewBlock>
        <ReviewBlock title="Envio">
          <SummaryLine label="Modo" value={form.scheduleMode === 'SCHEDULE' ? 'Agendado' : 'Envio imediato'} />
          <SummaryLine label="Data" value={form.scheduleMode === 'SCHEDULE' ? formatDateTime(form.scheduledAt) : 'Agora'} />
          <SummaryLine label="Fuso horário" value="America/Sao_Paulo" />
        </ReviewBlock>
      </div>
      <ReviewBlock title="Mensagem">
        <div className="whitespace-pre-line rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">{form.body}</div>
      </ReviewBlock>
      <div className="space-y-2">
        {!connected ? <ReviewAlert>O WhatsApp ainda não está conectado.</ReviewAlert> : null}
        {audienceTotal <= 0 ? <ReviewAlert>O público final está vazio.</ReviewAlert> : null}
        {invalidCount > 0 ? <ReviewAlert>{invalidCount} números inválidos serão ignorados.</ReviewAlert> : null}
        {duplicateCount > 0 ? <ReviewAlert>{duplicateCount} contatos duplicados serão ignorados.</ReviewAlert> : null}
      </div>
    </div>
  )
}

function ReviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <h4 className="mb-3 font-display text-base font-bold text-ink">{title}</h4>
      <div className="space-y-2 text-sm text-slate-600">{children}</div>
    </section>
  )
}

function ReviewAlert({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber/20 bg-amber/10 p-3 text-sm text-amber">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function SmallModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/55 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={onClose} />
      <div className="app-card relative z-10 w-full max-w-xl p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          <button type="button" className="button-ghost px-2 py-1" onClick={onClose} aria-label="Fechar modal">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CampaignConfirmationModal({
  open,
  form,
  channel,
  estimate,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean
  form: CampaignFormState
  channel?: CommunicationChannel
  estimate: number
  submitting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Voltar" onClick={onClose} />
      <div className="app-card relative z-10 w-full max-w-lg p-5">
        <h3 className="font-display text-lg font-bold text-ink">Confirmar envio da campanha</h3>
        <p className="mt-2 text-sm text-slate-500">Esta campanha será enviada para aproximadamente {currencyNumber(estimate)} contatos.</p>
        <div className="mt-5 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          <div><strong className="text-ink">Campanha:</strong> {form.title}</div>
          <div><strong className="text-ink">Público:</strong> {form.audienceMode === 'ALL' ? 'Toda a base' : form.audienceMode === 'MANUAL' ? `${parseManualRecipients(form.manualRecipients).length} telefones da lista manual` : form.audienceMode === 'IMPORT' ? `${parseManualRecipients(form.manualRecipients).length} telefones importados` : form.segmentType === 'CITY' ? `Cidade: ${form.city}` : 'Líder selecionado'}</div>
          <div><strong className="text-ink">Data:</strong> {form.scheduleMode === 'SCHEDULE' ? formatDateTime(form.scheduledAt) : 'Envio imediato'}</div>
          <div><strong className="text-ink">Número:</strong> {channel?.phoneNumber ?? 'WhatsApp conectado'}</div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="button-secondary" disabled={submitting} onClick={onClose}>Voltar</button>
          <button type="button" className="button-primary" disabled={submitting} onClick={onConfirm}>
            {submitting ? 'Confirmando...' : 'Confirmar campanha'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CampaignFormModal({
  open,
  children,
  onClose,
}: {
  open: boolean
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/55 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Fechar nova campanha" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Nova campanha" className="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl outline-none">
        <button type="button" className="absolute right-4 top-4 z-20 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink" aria-label="Fechar modal" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
    </div>
  )
}

export function CommunicationsPage() {
  const queryClient = useQueryClient()
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingCampaignAction>(null)
  const [toast, setToast] = useState('')
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(initialCampaignForm)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const overviewQuery = useQuery({
    queryKey: ['communications'],
    queryFn: async () => {
      const response = await api.get<CommunicationsOverview>('/communications/overview')
      return response.data
    },
    refetchInterval: qrModalOpen ? 5000 : false,
  })

  const leadersQuery = useQuery({
    queryKey: ['leaders-communications'],
    queryFn: async () => {
      const response = await api.get<{ leaders: Leader[] }>('/leaders')
      return response.data.leaders
    },
  })

  const overview = overviewQuery.data
  const whatsappChannel = useMemo(
    () => overview?.channels.find((channel) => channel.type === 'WHATSAPP' && channel.mode === 'QR') ?? overview?.channels.find((channel) => channel.type === 'WHATSAPP'),
    [overview?.channels],
  )
  const connectionStatus = whatsappChannel?.status ?? 'DISCONNECTED'
  const connectionStyle = connectionStyles[connectionStatus]
  const evolutionConfigured = overview?.integration?.evolutionConfigured ?? false
  const connected = ['CONNECTED', 'READY'].includes(connectionStatus)
  const queuedCampaigns = overview?.campaigns.filter((campaign) => ['QUEUED', 'SCHEDULED', 'DRAFT'].includes(campaign.status)).length ?? 0

  const estimateParams = useMemo(() => {
    const audienceType: CampaignAudienceType = campaignForm.audienceMode === 'ALL'
      ? 'ALL_SUPPORTERS'
      : campaignForm.audienceMode === 'MANUAL' || campaignForm.audienceMode === 'IMPORT'
        ? 'MANUAL_LIST'
        : campaignForm.segmentType === 'CITY'
          ? 'CITY'
          : 'LEADER'
    return {
      audienceType,
      city: audienceType === 'CITY' ? campaignForm.city : '',
      leaderId: audienceType === 'LEADER' ? campaignForm.leaderId : '',
    }
  }, [campaignForm])

  const estimateQuery = useQuery({
    queryKey: ['communications-audience-estimate', estimateParams],
    queryFn: async () => {
      const response = await api.get<{ total: number }>('/communications/audience-estimate', { params: estimateParams })
      return response.data.total
    },
    enabled: Boolean(overview) && campaignForm.audienceMode !== 'MANUAL' && campaignForm.audienceMode !== 'IMPORT',
  })

  const manualCampaignRecipientsCount = parseManualRecipients(campaignForm.manualRecipients).length
  const currentCampaignAudienceCount = campaignForm.audienceMode === 'MANUAL' || campaignForm.audienceMode === 'IMPORT'
    ? manualCampaignRecipientsCount
    : estimateQuery.data ?? 0

  const ensureQrChannelMutation = useMutation({
    mutationFn: async () => {
      if (whatsappChannel) return whatsappChannel
      const response = await api.post<{ channel: CommunicationChannel }>('/communications/channels/whatsapp-qr')
      return response.data.channel
    },
  })

  const refreshQrMutation = useMutation({
    mutationFn: async (channelId: string) => api.post(`/communications/channels/${channelId}/qrcode`),
    onSuccess: async () => {
      setQrModalOpen(true)
      await queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const disconnectMutation = useMutation({
    mutationFn: async (channelId: string) => api.post(`/communications/channels/${channelId}/disconnect`),
    onSuccess: async () => {
      setToast('Sessão do WhatsApp encerrada.')
      await queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const createCampaignMutation = useMutation({
    mutationFn: async (action: Exclude<PendingCampaignAction, null>) => {
      const audienceType: CampaignAudienceType = campaignForm.audienceMode === 'ALL'
        ? 'ALL_SUPPORTERS'
        : campaignForm.audienceMode === 'MANUAL' || campaignForm.audienceMode === 'IMPORT'
          ? 'MANUAL_LIST'
          : campaignForm.segmentType === 'CITY'
            ? 'CITY'
            : 'LEADER'

      return api.post('/communications/campaigns', {
        title: campaignForm.title,
        subject: null,
        body: campaignForm.body,
        channelConfigId: whatsappChannel?.id,
        audienceType,
        city: audienceType === 'CITY' ? campaignForm.city : null,
        electoralZone: null,
        leaderId: audienceType === 'LEADER' ? campaignForm.leaderId : null,
        manualRecipients: audienceType === 'MANUAL_LIST' ? parseManualRecipients(campaignForm.manualRecipients) : [],
        scheduledAt: campaignForm.scheduleMode === 'SCHEDULE' ? campaignForm.scheduledAt : null,
        notifyAllBase: false,
        saveAsDraft: action === 'draft',
      })
    },
    onSuccess: async (_response, action) => {
      setConfirmOpen(false)
      setCampaignModalOpen(false)
      setPendingAction(null)
      setCampaignForm(initialCampaignForm)
      setToast(action === 'draft' ? 'Rascunho salvo com sucesso.' : 'Campanha criada com sucesso.')
      await queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  async function openQrFlow() {
    try {
      const channel = await ensureQrChannelMutation.mutateAsync()
      await refreshQrMutation.mutateAsync(channel.id)
      setQrModalOpen(true)
    } catch (error) {
      alert(getErrorMessage(error))
    }
  }

  function validateCampaign(action: Exclude<PendingCampaignAction, null>) {
    if (campaignForm.title.trim().length < 3) return 'Informe o nome da campanha.'
    if (campaignForm.body.trim().length < 10) return 'Digite a mensagem da campanha.'
    if (campaignForm.body.length > messageLimit) return 'A mensagem ultrapassou o limite de caracteres.'
    if (action !== 'draft' && !evolutionConfigured) return 'Configure o WAHA antes de enviar campanhas reais.'
    if (action !== 'draft' && !connected) return 'Conecte um número do WhatsApp antes de criar uma campanha.'
    if ((campaignForm.audienceMode === 'MANUAL' || campaignForm.audienceMode === 'IMPORT') && parseManualRecipients(campaignForm.manualRecipients).length === 0) return 'Informe ao menos um telefone válido na lista manual.'
    if (campaignForm.audienceMode === 'SEGMENT' && campaignForm.segmentType === 'CITY' && !campaignForm.city.trim()) return 'Informe a cidade do segmento.'
    if (campaignForm.audienceMode === 'SEGMENT' && campaignForm.segmentType === 'LEADER' && !campaignForm.leaderId) return 'Selecione o líder do segmento.'
    if (campaignForm.scheduleMode === 'SCHEDULE') {
      if (!campaignForm.scheduledAt) return 'Informe data e horário para agendar.'
      if (new Date(campaignForm.scheduledAt) <= new Date()) return 'Escolha uma data futura para agendar.'
    }
    if (action !== 'draft' && currentCampaignAudienceCount <= 0) return 'Nenhum contato apto encontrado para o público selecionado.'
    return null
  }

  function requestCampaignSubmit(action: Exclude<PendingCampaignAction, null>) {
    const error = validateCampaign(action)
    if (error) {
      alert(error)
      return
    }

    if (action === 'send') {
      setPendingAction(action)
      setConfirmOpen(true)
      return
    }

    createCampaignMutation.mutate(action)
  }

  if (overviewQuery.isLoading || !overview) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="page-title">WhatsApp Business</h2>
          <p className="page-subtitle mt-1">Gerencie a conexão do número e envie campanhas para sua base.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/5 px-3 py-2 text-xs font-semibold text-teal">
          <ShieldCheck className="h-4 w-4" />
          LGPD e auditoria ativas
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Status da conexão" value={connectionLabels[connectionStatus]} icon={connected ? CheckCircle2 : Smartphone} tone={`${connectionStyle.card} ${connectionStyle.icon}`} />
        <StatCard title="Campanhas na fila" value={queuedCampaigns} icon={Send} tone="bg-blue-50 text-blue-600" />
        <StatCard title="Não lidas" value={overview.metrics.unreadInbox} icon={MessageSquareMore} tone="bg-amber/10 text-amber" />
        <StatCard title="Alcance da base" value={currencyNumber(overview.metrics.baseReach)} icon={Users} tone="bg-emerald-50 text-emerald-600" />
      </div>

      <WhatsAppConnectionCard
        channel={whatsappChannel}
        evolutionConfigured={evolutionConfigured}
        refreshing={refreshQrMutation.isPending || ensureQrChannelMutation.isPending}
        disconnecting={disconnectMutation.isPending}
        onConnect={openQrFlow}
        onDisconnect={() => {
          if (!whatsappChannel) return
          if (window.confirm(`Desconectar o número ${whatsappChannel.phoneNumber || whatsappChannel.senderId || 'WhatsApp Business'}?`)) {
            disconnectMutation.mutate(whatsappChannel.id)
          }
        }}
      />

      <RecentCampaigns campaigns={overview.campaigns.filter((campaign) => campaign.channelType === 'WHATSAPP')} onCreate={() => setCampaignModalOpen(true)} />

      <CampaignFormModal open={campaignModalOpen} onClose={() => setCampaignModalOpen(false)}>
        <NewCampaignForm
          form={campaignForm}
          leaders={leadersQuery.data ?? []}
          estimate={estimateQuery.data}
          channel={whatsappChannel}
          connected={connected}
          evolutionConfigured={evolutionConfigured}
          submitting={createCampaignMutation.isPending}
          onChange={setCampaignForm}
          onSubmit={requestCampaignSubmit}
          onOpenQr={openQrFlow}
        />
      </CampaignFormModal>

      <WhatsAppQrModal
        open={qrModalOpen}
        channel={whatsappChannel}
        evolutionConfigured={evolutionConfigured}
        refreshing={refreshQrMutation.isPending || ensureQrChannelMutation.isPending}
        onRefresh={openQrFlow}
        onClose={() => setQrModalOpen(false)}
      />

      <CampaignConfirmationModal
        open={confirmOpen}
        form={campaignForm}
        channel={whatsappChannel}
        estimate={currentCampaignAudienceCount}
        submitting={createCampaignMutation.isPending}
        onClose={() => {
          setConfirmOpen(false)
          setPendingAction(null)
        }}
        onConfirm={() => createCampaignMutation.mutate(pendingAction ?? 'send')}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] rounded-xl border border-teal/20 bg-white px-4 py-3 text-sm font-semibold text-teal shadow-card-md">
          {toast}
        </div>
      )}
    </div>
  )
}
