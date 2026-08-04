import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  Loader2,
  MessageCircle,
  MessageSquareMore,
  MoreVertical,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
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
  body: string
  audienceMode: 'ALL' | 'SEGMENT'
  segmentType: 'CITY' | 'LEADER'
  city: string
  leaderId: string
  scheduleMode: 'NOW' | 'SCHEDULE'
  scheduledAt: string
}

type PendingCampaignAction = 'draft' | 'send' | null

const initialCampaignForm: CampaignFormState = {
  title: '',
  body: '',
  audienceMode: 'ALL',
  segmentType: 'CITY',
  city: '',
  leaderId: '',
  scheduleMode: 'NOW',
  scheduledAt: '',
}

const messageLimit = 1024

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
            <h3 className="font-display text-lg font-bold text-ink">Conectar WhatsApp Business</h3>
            <p className="mt-1 text-sm text-slate-500">Escaneie o QR Code com o WhatsApp do número que será utilizado.</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink" aria-label="Fechar modal" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[240px,1fr]">
          <div>
            <WhatsAppQrPreview token={channel?.qrToken} />
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
          <button type="button" className="button-secondary" disabled={refreshing} onClick={onRefresh}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar QR
          </button>
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancelar
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
  const number = channel?.phoneNumber || channel?.senderId || 'Número não conectado'

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
  connected: boolean
  evolutionConfigured: boolean
  submitting: boolean
  onChange: (form: CampaignFormState) => void
  onSubmit: (action: Exclude<PendingCampaignAction, null>) => void
  onOpenQr: () => void
}) {
  const charsLeft = messageLimit - form.body.length
  const isScheduled = form.scheduleMode === 'SCHEDULE'

  return (
    <section className="app-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Nova campanha</h3>
          <p className="mt-1 text-sm text-slate-500">Crie uma comunicação para toda a base ou para um público específico.</p>
        </div>
        {!connected ? (
          <button type="button" className="button-secondary text-xs" onClick={onOpenQr}>
            <QrCode className="h-4 w-4" />
            Conectar WhatsApp
          </button>
        ) : null}
      </div>

      {!evolutionConfigured ? (
        <div className="mt-5 rounded-xl border border-amber/20 bg-amber/10 p-4 text-sm text-amber">
          O WAHA ainda nao foi configurado no servidor. Voce pode preparar rascunhos, mas o envio real sera liberado depois da configuracao.
        </div>
      ) : !connected ? (
        <div className="mt-5 rounded-xl border border-amber/20 bg-amber/10 p-4 text-sm text-amber">
          Conecte um número do WhatsApp antes de criar uma campanha.
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr,1fr,1fr]">
        <div className="space-y-4">
          <div className="section-label">Conteúdo</div>
          <Field label="Nome da campanha">
            <TextInput value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="Ex.: Promoção de fim de semana" />
          </Field>
          <Field label="Mensagem">
            <TextAreaInput value={form.body} onChange={(event) => onChange({ ...form, body: event.target.value.slice(0, messageLimit) })} placeholder="Digite a mensagem que será enviada pelo WhatsApp." />
          </Field>
          <div className={`text-right text-xs ${charsLeft < 80 ? 'text-amber' : 'text-slate-400'}`}>{form.body.length}/{messageLimit}</div>
        </div>

        <div className="space-y-4">
          <div className="section-label">Público</div>
          <RadioCard active={form.audienceMode === 'ALL'} title="Toda a base" description="Enviar para todos os contatos aptos da sua base." onClick={() => onChange({ ...form, audienceMode: 'ALL' })} />
          <RadioCard active={form.audienceMode === 'SEGMENT'} title="Segmento específico" description="Escolha filtros para enviar somente para parte da sua base." onClick={() => onChange({ ...form, audienceMode: 'SEGMENT' })} />
          {form.audienceMode === 'SEGMENT' ? (
            <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <Field label="Filtro">
                <SelectInput value={form.segmentType} onChange={(event) => onChange({ ...form, segmentType: event.target.value as CampaignFormState['segmentType'] })}>
                  <option value="CITY">Cidade</option>
                  <option value="LEADER">Líder</option>
                </SelectInput>
              </Field>
              {form.segmentType === 'CITY' ? (
                <Field label="Cidade">
                  <TextInput value={form.city} onChange={(event) => onChange({ ...form, city: event.target.value })} />
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
          <div className="rounded-xl border border-teal/10 bg-teal/5 p-3 text-sm text-teal">
            Público estimado: <strong>{estimate === undefined ? 'calculando...' : `${currencyNumber(estimate)} contatos aptos`}</strong>
          </div>
        </div>

        <div className="space-y-4">
          <div className="section-label">Agendamento</div>
          <RadioCard active={form.scheduleMode === 'NOW'} title="Enviar agora" description="Preparar a campanha para envio imediato." onClick={() => onChange({ ...form, scheduleMode: 'NOW', scheduledAt: '' })} />
          <RadioCard active={form.scheduleMode === 'SCHEDULE'} title="Agendar envio" description="Escolha data e horário para disparar." onClick={() => onChange({ ...form, scheduleMode: 'SCHEDULE' })} />
          {isScheduled ? (
            <Field label="Agendar para">
              <TextInput type="datetime-local" value={form.scheduledAt} onChange={(event) => onChange({ ...form, scheduledAt: event.target.value })} />
            </Field>
          ) : null}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            O horário de envio respeita o fuso horário do número conectado.
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="section-label">Pré-visualização</div>
        <div className="mt-3 max-w-md rounded-2xl bg-[#d8fdd2] px-4 py-3 text-sm text-slate-700 shadow-sm">
          <div className="whitespace-pre-line">{form.body || 'Sua mensagem aparecerá aqui.'}</div>
          <div className="mt-2 text-right text-[10px] text-slate-500">09:41</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" className="button-secondary" disabled={submitting} onClick={() => onSubmit('draft')}>
          Salvar rascunho
        </button>
        <button type="button" className="button-primary" disabled={submitting || !connected || !evolutionConfigured} onClick={() => onSubmit('send')}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {form.scheduleMode === 'SCHEDULE' ? 'Agendar campanha' : 'Enviar campanha'}
        </button>
      </div>
    </section>
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
          <div><strong className="text-ink">Público:</strong> {form.audienceMode === 'ALL' ? 'Toda a base' : form.segmentType === 'CITY' ? `Cidade: ${form.city}` : 'Líder selecionado'}</div>
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
  const modalRef = useRef<HTMLDivElement>(null)

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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/55 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0" aria-label="Fechar nova campanha" onClick={onClose} />
      <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Nova campanha" className="relative z-10 max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl outline-none">
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
    enabled: Boolean(overview),
  })

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
    if (campaignForm.audienceMode === 'SEGMENT' && campaignForm.segmentType === 'CITY' && !campaignForm.city.trim()) return 'Informe a cidade do segmento.'
    if (campaignForm.audienceMode === 'SEGMENT' && campaignForm.segmentType === 'LEADER' && !campaignForm.leaderId) return 'Selecione o líder do segmento.'
    if (campaignForm.scheduleMode === 'SCHEDULE') {
      if (!campaignForm.scheduledAt) return 'Informe data e horário para agendar.'
      if (new Date(campaignForm.scheduledAt) <= new Date()) return 'Escolha uma data futura para agendar.'
    }
    if (action !== 'draft' && (estimateQuery.data ?? 0) <= 0) return 'Nenhum contato apto encontrado para o público selecionado.'
    return null
  }

  function requestCampaignSubmit(action: Exclude<PendingCampaignAction, null>) {
    const error = validateCampaign(action)
    if (error) {
      alert(error)
      return
    }

    if (action === 'send' && campaignForm.audienceMode === 'ALL') {
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
        estimate={estimateQuery.data ?? 0}
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
