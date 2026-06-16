import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquareMore, QrCode, RadioTower, Send, Smartphone } from 'lucide-react'
import { CheckboxInput, Field, SelectInput, TextAreaInput, TextInput } from '../components/FormControls'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { formatDateTime, statusLabel } from '../lib/format'
import type { CommunicationChannelType, CommunicationsOverview, Leader } from '../types/api'

const channelIcons: Record<CommunicationChannelType, typeof Smartphone> = {
  WHATSAPP: Smartphone,
  SMS: RadioTower,
  EMAIL: Mail,
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/80 p-5 shadow-glow">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 font-display text-4xl font-bold text-ink">{value}</div>
    </div>
  )
}

function ChannelCard({
  channel,
  onRefreshQr,
}: {
  channel: CommunicationsOverview['channels'][number]
  onRefreshQr: (id: string) => void
}) {
  const Icon = channelIcons[channel.type]
  return (
    <div className="rounded-[30px] border border-white/60 bg-white/85 p-5 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-ink p-3 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-ink">{channel.name}</div>
            <div className="text-sm text-slate-500">
              {statusLabel(channel.type)} • {statusLabel(channel.mode)}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-ink">{statusLabel(channel.status)}</span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600">
        <div>Fornecedor: {channel.providerName || 'Configuracao manual'}</div>
        <div>Identificador: {channel.senderId || channel.phoneNumber || '-'}</div>
        <div>Ultima sincronizacao: {formatDateTime(channel.lastSyncAt)}</div>
      </div>

      {channel.mode === 'QR' ? (
        <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50/90 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <QrCode className="h-4 w-4" />
            Vinculacao por QR Code
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1 rounded-2xl bg-white p-3">
            {Array.from({ length: 25 }).map((_, index) => (
              <div
                key={`${channel.id}-${index}`}
                className={`aspect-square rounded-[4px] ${((channel.qrToken?.charCodeAt(index % (channel.qrToken.length || 1)) || index) + index) % 3 === 0 ? 'bg-ink' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <div className="mt-3 break-all text-xs text-slate-500">{channel.qrToken || 'QR pendente'}</div>
          <button type="button" className="button-secondary mt-4" onClick={() => onRefreshQr(channel.id)}>
            Atualizar QR
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function CommunicationsPage() {
  const queryClient = useQueryClient()
  const [channelForm, setChannelForm] = useState({
    name: '',
    type: 'WHATSAPP',
    mode: 'API',
    providerName: '',
    apiBaseUrl: '',
    apiToken: '',
    senderId: '',
    phoneNumber: '',
    isDefault: true,
  })
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    subject: '',
    body: '',
    channelConfigId: '',
    audienceType: 'ALL_SUPPORTERS',
    city: '',
    electoralZone: '',
    leaderId: '',
    scheduledAt: '',
    notifyAllBase: true,
  })

  const overviewQuery = useQuery({
    queryKey: ['communications'],
    queryFn: async () => {
      const response = await api.get<CommunicationsOverview>('/communications/overview')
      return response.data
    },
  })

  const leadersQuery = useQuery({
    queryKey: ['leaders-communications'],
    queryFn: async () => {
      const response = await api.get<{ leaders: Leader[] }>('/leaders')
      return response.data.leaders
    },
  })

  const createChannelMutation = useMutation({
    mutationFn: async () => api.post('/communications/channels', channelForm),
    onSuccess: async () => {
      setChannelForm({
        name: '',
        type: 'WHATSAPP',
        mode: 'API',
        providerName: '',
        apiBaseUrl: '',
        apiToken: '',
        senderId: '',
        phoneNumber: '',
        isDefault: true,
      })
      await queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const refreshQrMutation = useMutation({
    mutationFn: async (channelId: string) => api.post(`/communications/channels/${channelId}/qrcode`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const createCampaignMutation = useMutation({
    mutationFn: async () => api.post('/communications/campaigns', campaignForm),
    onSuccess: async () => {
      setCampaignForm({
        title: '',
        subject: '',
        body: '',
        channelConfigId: '',
        audienceType: 'ALL_SUPPORTERS',
        city: '',
        electoralZone: '',
        leaderId: '',
        scheduledAt: '',
        notifyAllBase: true,
      })
      await queryClient.invalidateQueries({ queryKey: ['communications'] })
      alert('Campanha criada e fila de disparo preparada.')
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/communications/inbox/${id}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['communications'] })
    },
  })

  const overview = overviewQuery.data
  const leaderOptions = leadersQuery.data ?? []
  const defaultChannel = useMemo(
    () => overview?.channels.find((channel) => channel.isDefault) ?? overview?.channels[0],
    [overview],
  )

  if (!overview) {
    return <div className="app-card p-8 text-slate-600">Carregando central de comunicacao...</div>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[34px] bg-ink p-6 text-white shadow-glow">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/55">Disparo e relacionamento</div>
            <h2 className="mt-3 font-display text-4xl font-bold">Central de comunicacao omnichannel</h2>
            <p className="mt-4 max-w-2xl text-sm text-white/72">
              Configure APIs de WhatsApp, use pareamento via QR Code para Business ou monte campanhas SMS e e-mail.
              A mesma tela tambem prepara avisos para toda a base cadastrada.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <MetricTile label="Canais ativos" value={overview.metrics.connectedChannels} />
              <MetricTile label="Campanhas na fila" value={overview.metrics.queuedCampaigns} />
              <MetricTile label="Nao lidas" value={overview.metrics.unreadInbox} />
              <MetricTile label="Alcance da base" value={overview.metrics.baseReach} />
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/10 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-white/55">Canal preferencial</div>
            <div className="mt-3 font-display text-2xl font-bold">{defaultChannel?.name}</div>
            <div className="mt-2 text-sm text-white/72">
              {defaultChannel ? `${statusLabel(defaultChannel.type)} em modo ${statusLabel(defaultChannel.mode)}` : 'Nenhum canal configurado'}
            </div>
            <div className="mt-6 rounded-3xl bg-white/10 p-4 text-sm text-white/75">
              Use QR quando quiser operar o WhatsApp Business localmente, ou API quando a campanha precisar de automacao escalavel.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/60 bg-white/85 p-6 shadow-glow">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Conectores</div>
                <h3 className="font-display text-2xl font-bold text-ink">Canais configurados</h3>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {overview.channels.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} onRefreshQr={(id) => refreshQrMutation.mutate(id)} />
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/85 p-6 shadow-glow">
            <div className="text-sm text-slate-500">Fila de campanhas</div>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Disparos recentes</h3>
            <div className="mt-5 space-y-3">
              {overview.campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-3xl border border-slate-100 bg-slate-50/90 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink">{campaign.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {campaign.channelName} • {statusLabel(campaign.audienceType)} • {campaign.notifyAllBase ? 'Toda a base' : 'Segmentado'}
                      </div>
                    </div>
                    <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-ink">{statusLabel(campaign.status)}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                    <div>Destinatarios: {campaign.recipientsCount}</div>
                    <div>Entregues: {campaign.deliveredCount}</div>
                    <div>Criada em: {formatDateTime(campaign.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/60 bg-white/85 p-6 shadow-glow">
            <div className="text-sm text-slate-500">Novo conector</div>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Preparar integracao</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Nome do canal">
                <TextInput value={channelForm.name} onChange={(event) => setChannelForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Tipo">
                <SelectInput value={channelForm.type} onChange={(event) => setChannelForm((current) => ({ ...current, type: event.target.value as typeof current.type }))}>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">E-mail</option>
                </SelectInput>
              </Field>
              <Field label="Modo">
                <SelectInput value={channelForm.mode} onChange={(event) => setChannelForm((current) => ({ ...current, mode: event.target.value as typeof current.mode }))}>
                  <option value="API">API</option>
                  <option value="QR">QR Code</option>
                  <option value="MANUAL">Manual</option>
                </SelectInput>
              </Field>
              <Field label="Fornecedor">
                <TextInput value={channelForm.providerName} onChange={(event) => setChannelForm((current) => ({ ...current, providerName: event.target.value }))} />
              </Field>
              <Field label="Base URL / Host">
                <TextInput value={channelForm.apiBaseUrl} onChange={(event) => setChannelForm((current) => ({ ...current, apiBaseUrl: event.target.value }))} />
              </Field>
              <Field label="Sender ID / numero">
                <TextInput value={channelForm.senderId} onChange={(event) => setChannelForm((current) => ({ ...current, senderId: event.target.value }))} />
              </Field>
              <Field label="Token da API">
                <TextInput value={channelForm.apiToken} onChange={(event) => setChannelForm((current) => ({ ...current, apiToken: event.target.value }))} />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <CheckboxInput checked={channelForm.isDefault} onChange={(event) => setChannelForm((current) => ({ ...current, isDefault: event.target.checked }))} />
                <span className="text-sm font-medium text-slate-700">Definir como canal padrao</span>
              </label>
            </div>
            <button type="button" className="button-primary mt-5 w-full" onClick={() => createChannelMutation.mutate()} disabled={createChannelMutation.isPending}>
              {createChannelMutation.isPending ? 'Salvando...' : 'Adicionar canal'}
            </button>
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/85 p-6 shadow-glow">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Send className="h-4 w-4" />
              Nova campanha
            </div>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Notificar toda a base ou segmentar</h3>
            <div className="mt-5 grid gap-4">
              <Field label="Titulo">
                <TextInput value={campaignForm.title} onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))} />
              </Field>
              <Field label="Assunto opcional">
                <TextInput value={campaignForm.subject} onChange={(event) => setCampaignForm((current) => ({ ...current, subject: event.target.value }))} />
              </Field>
              <Field label="Mensagem">
                <TextAreaInput value={campaignForm.body} onChange={(event) => setCampaignForm((current) => ({ ...current, body: event.target.value }))} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Canal">
                  <SelectInput value={campaignForm.channelConfigId} onChange={(event) => setCampaignForm((current) => ({ ...current, channelConfigId: event.target.value }))}>
                    <option value="">Selecione</option>
                    {overview.channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Publico">
                  <SelectInput value={campaignForm.audienceType} onChange={(event) => setCampaignForm((current) => ({ ...current, audienceType: event.target.value as typeof current.audienceType }))}>
                    <option value="ALL_SUPPORTERS">Toda a base</option>
                    <option value="CITY">Cidade</option>
                    <option value="ELECTORAL_ZONE">Zona eleitoral</option>
                    <option value="LEADER">Lider</option>
                  </SelectInput>
                </Field>
                {campaignForm.audienceType === 'CITY' ? (
                  <Field label="Cidade">
                    <TextInput value={campaignForm.city} onChange={(event) => setCampaignForm((current) => ({ ...current, city: event.target.value }))} />
                  </Field>
                ) : null}
                {campaignForm.audienceType === 'ELECTORAL_ZONE' ? (
                  <Field label="Zona eleitoral">
                    <TextInput value={campaignForm.electoralZone} onChange={(event) => setCampaignForm((current) => ({ ...current, electoralZone: event.target.value }))} />
                  </Field>
                ) : null}
                {campaignForm.audienceType === 'LEADER' ? (
                  <Field label="Lider">
                    <SelectInput value={campaignForm.leaderId} onChange={(event) => setCampaignForm((current) => ({ ...current, leaderId: event.target.value }))}>
                      <option value="">Selecione</option>
                      {leaderOptions.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                ) : null}
                <Field label="Agendar para">
                  <TextInput type="datetime-local" value={campaignForm.scheduledAt} onChange={(event) => setCampaignForm((current) => ({ ...current, scheduledAt: event.target.value }))} />
                </Field>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <CheckboxInput checked={campaignForm.notifyAllBase} onChange={(event) => setCampaignForm((current) => ({ ...current, notifyAllBase: event.target.checked }))} />
                <span className="text-sm font-medium text-slate-700">Marcar como comunicacao para toda a base</span>
              </label>
            </div>
            <button type="button" className="button-primary mt-5 w-full" onClick={() => createCampaignMutation.mutate()} disabled={createCampaignMutation.isPending}>
              {createCampaignMutation.isPending ? 'Preparando fila...' : 'Criar campanha'}
            </button>
          </div>

          <div className="rounded-[30px] border border-white/60 bg-white/85 p-6 shadow-glow">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MessageSquareMore className="h-4 w-4" />
              Caixa de entrada
            </div>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">Respostas da base</h3>
            <div className="mt-5 space-y-3">
              {overview.inbox.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`w-full rounded-3xl border p-4 text-left transition ${item.readAt ? 'border-slate-100 bg-slate-50/70' : 'border-teal/20 bg-teal/5'}`}
                  onClick={() => {
                    if (!item.readAt) {
                      markReadMutation.mutate(item.id)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink">{item.senderName}</div>
                      <div className="text-sm text-slate-500">
                        {item.senderAddress} • {statusLabel(item.channelType)}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{formatDateTime(item.receivedAt)}</div>
                  </div>
                  <div className="mt-3 text-sm text-slate-700">{item.body}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
