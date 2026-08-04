import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Clock3, ClipboardList, Search, Trash2 } from 'lucide-react'
import { Field, SelectInput, TextAreaInput, TextInput } from '../components/FormControls'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { formatDateTime } from '../lib/format'
import type { CabinetDemand, DemandResponsibleUser, DemandStatus, DemandsResponse } from '../types/api'

type DemandForm = {
  title: string
  description: string
  requesterName: string
  requesterPhone: string
  requesterAddress: string
  requesterCity: string
  requesterNeighborhood: string
  responsibleUserId: string
  status: DemandStatus
  historyNote: string
}

type DemandFilters = {
  search: string
  status: string
  responsibleUserId: string
  city: string
  neighborhood: string
}

const initialForm: DemandForm = {
  title: '',
  description: '',
  requesterName: '',
  requesterPhone: '',
  requesterAddress: '',
  requesterCity: '',
  requesterNeighborhood: '',
  responsibleUserId: '',
  status: 'REQUESTED',
  historyNote: '',
}

const statusLabel: Record<DemandStatus, string> = {
  REQUESTED: 'Solicitada',
  IN_PROGRESS: 'Em processo',
  RESOLVED: 'Resolvida',
}

const statusStyles: Record<DemandStatus, string> = {
  REQUESTED: 'border-amber/30 bg-amber/10 text-amber',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  RESOLVED: 'border-teal/30 bg-teal/10 text-teal',
}

function normalizeForm(form: DemandForm) {
  return {
    ...form,
    title: form.title.trim(),
    description: form.description.trim(),
    requesterName: form.requesterName.trim(),
    requesterPhone: form.requesterPhone.trim(),
    requesterAddress: form.requesterAddress.trim(),
    requesterCity: form.requesterCity.trim(),
    requesterNeighborhood: form.requesterNeighborhood.trim(),
    historyNote: form.historyNote.trim(),
  }
}

function DemandCard({
  demand,
  responsibles,
  onStatusChange,
  onDelete,
  canDelete,
}: {
  demand: CabinetDemand
  responsibles: DemandResponsibleUser[]
  onStatusChange: (demand: CabinetDemand, status: DemandStatus, note: string, responsibleUserId: string) => void
  onDelete: (demand: CabinetDemand) => void
  canDelete: boolean
}) {
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<DemandStatus>(demand.status)
  const [responsibleUserId, setResponsibleUserId] = useState(demand.responsibleUserId ?? '')

  return (
    <article className="app-card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-label">Demanda</div>
            <h3 className="mt-1 font-display text-lg font-bold text-ink">{demand.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{demand.description}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[demand.status]}`}>
            {statusLabel[demand.status]}
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Solicitante</div>
            <div className="mt-1 font-semibold text-ink">{demand.requesterName}</div>
            <div className="mt-0.5">{demand.requesterPhone}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Endereço</div>
            <div className="mt-1 font-semibold text-ink">{demand.requesterAddress}</div>
            <div className="mt-0.5">{[demand.requesterNeighborhood, demand.requesterCity].filter(Boolean).join(' · ') || 'Sem bairro/cidade'}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Responsável</div>
            <div className="mt-1 font-semibold text-ink">{demand.responsibleUserName ?? 'Não definido'}</div>
            <div className="mt-0.5">Recebida por {demand.createdByUserName}</div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prazos</div>
            <div className="mt-1">Criada em {formatDateTime(demand.createdAt)}</div>
            <div className="mt-0.5 font-semibold text-ink">
              {demand.resolvedAt ? `Sanada em ${formatDateTime(demand.resolvedAt)}` : 'Ainda não sanada'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="section-label">Atualização</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Field label="Status">
              <SelectInput value={status} onChange={(event) => setStatus(event.target.value as DemandStatus)}>
                {(Object.keys(statusLabel) as DemandStatus[]).map((item) => (
                  <option key={item} value={item}>{statusLabel[item]}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Responsável">
              <SelectInput value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)}>
                <option value="">Não definido</option>
                {responsibles.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </SelectInput>
            </Field>
            <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2">
              <Field label="Observação do histórico">
                <TextAreaInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex: encaminhada para equipe de zeladoria" />
              </Field>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="button-primary"
              onClick={() => onStatusChange(demand, status, note, responsibleUserId)}
            >
              Atualizar demanda
            </button>
            {canDelete && (
              <button type="button" className="button-danger" onClick={() => onDelete(demand)}>
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 pb-5">
        <div className="mt-4 section-label">Histórico da solicitação</div>
        <div className="mt-3 space-y-2">
          {demand.history.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  {item.previousStatus ? `${statusLabel[item.previousStatus]} -> ` : ''}
                  {statusLabel[item.nextStatus]}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(item.createdAt)} por {item.updatedByUserName}</span>
              </div>
              {item.note && <p className="mt-1 text-slate-500">{item.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

export function DemandsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<DemandForm>(initialForm)
  const [filters, setFilters] = useState<DemandFilters>({
    search: '',
    status: '',
    responsibleUserId: '',
    city: '',
    neighborhood: '',
  })

  const params = useMemo(() => {
    const searchParams = new URLSearchParams({ page: String(page), limit: '25' })
    Object.entries(filters).forEach(([key, value]) => {
      if (value) searchParams.set(key, value)
    })
    return searchParams.toString()
  }, [filters, page])

  const demandsQuery = useQuery({
    queryKey: ['demands', params],
    queryFn: async () => {
      const response = await api.get<DemandsResponse>(`/demands?${params}`)
      return response.data
    },
  })

  const responsiblesQuery = useQuery({
    queryKey: ['demand-responsibles'],
    queryFn: async () => {
      const response = await api.get<{ users: DemandResponsibleUser[] }>('/demands/responsibles')
      return response.data.users
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: DemandForm) => {
      const payload = normalizeForm(values)
      if (payload.title.length < 3 || payload.description.length < 3) {
        throw new Error('Informe a demanda e a descrição com pelo menos 3 caracteres.')
      }
      if (payload.requesterName.length < 3 || payload.requesterPhone.length < 8 || payload.requesterAddress.length < 5) {
        throw new Error('Informe nome, telefone e endereço do solicitante.')
      }
      const response = await api.post('/demands', payload)
      return response.data
    },
    onSuccess: async () => {
      setForm(initialForm)
      await queryClient.invalidateQueries({ queryKey: ['demands'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ demand, status, historyNote, responsibleUserId }: { demand: CabinetDemand; status: DemandStatus; historyNote: string; responsibleUserId: string }) => {
      const response = await api.patch(`/demands/${demand.id}`, { status, historyNote, responsibleUserId })
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['demands'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (demand: CabinetDemand) => {
      await api.delete(`/demands/${demand.id}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['demands'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const data = demandsQuery.data
  const demands = data?.demands ?? []
  const responsibles = responsiblesQuery.data ?? []

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="app-card flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 text-amber">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="section-label">Solicitadas</div>
            <div className="font-display text-3xl font-bold text-ink">{data?.metrics.requested ?? 0}</div>
          </div>
        </div>
        <div className="app-card flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <div className="section-label">Em processo</div>
            <div className="font-display text-3xl font-bold text-ink">{data?.metrics.inProgress ?? 0}</div>
          </div>
        </div>
        <div className="app-card flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 text-teal">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="section-label">Resolvidas</div>
            <div className="font-display text-3xl font-bold text-ink">{data?.metrics.resolved ?? 0}</div>
          </div>
        </div>
      </section>

      <section className="app-card p-5">
        <div className="border-b border-slate-100 pb-4">
          <div className="section-label">Nova solicitação</div>
          <h2 className="mt-1 font-display text-base font-bold text-ink">Cadastrar demanda do gabinete</h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Field label="Demanda">
            <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: manutenção de iluminação" />
          </Field>
          <Field label="Status da demanda">
            <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as DemandStatus }))}>
              {(Object.keys(statusLabel) as DemandStatus[]).map((status) => (
                <option key={status} value={status}>{statusLabel[status]}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Quem recebeu">
            <SelectInput value={form.responsibleUserId} onChange={(event) => setForm((current) => ({ ...current, responsibleUserId: event.target.value }))}>
              <option value="">Usuário atual</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>{responsible.name}</option>
              ))}
            </SelectInput>
          </Field>
          <div className="lg:col-span-3">
            <Field label="Descrição da demanda">
              <TextAreaInput value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Descreva o pedido feito ao gabinete" />
            </Field>
          </div>
          <Field label="Nome do solicitante">
            <TextInput value={form.requesterName} onChange={(event) => setForm((current) => ({ ...current, requesterName: event.target.value }))} />
          </Field>
          <Field label="Telefone">
            <TextInput value={form.requesterPhone} onChange={(event) => setForm((current) => ({ ...current, requesterPhone: event.target.value }))} />
          </Field>
          <Field label="Cidade">
            <TextInput value={form.requesterCity} onChange={(event) => setForm((current) => ({ ...current, requesterCity: event.target.value }))} />
          </Field>
          <Field label="Bairro">
            <TextInput value={form.requesterNeighborhood} onChange={(event) => setForm((current) => ({ ...current, requesterNeighborhood: event.target.value }))} />
          </Field>
          <div className="lg:col-span-2">
            <Field label="Endereço do solicitante">
              <TextInput value={form.requesterAddress} onChange={(event) => setForm((current) => ({ ...current, requesterAddress: event.target.value }))} />
            </Field>
          </div>
          <div className="lg:col-span-3">
            <Field label="Observação inicial do histórico">
              <TextAreaInput value={form.historyNote} onChange={(event) => setForm((current) => ({ ...current, historyNote: event.target.value }))} placeholder="Ex: solicitação recebida por WhatsApp" />
            </Field>
          </div>
        </div>
        <button type="button" className="button-primary mt-4" disabled={createMutation.isPending} onClick={() => createMutation.mutate(form)}>
          {createMutation.isPending ? 'Cadastrando...' : 'Cadastrar demanda'}
        </button>
      </section>

      <section className="app-card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="Buscar">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput className="pl-9" value={filters.search} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, search: event.target.value })) }} placeholder="Demanda, solicitante ou telefone" />
              </div>
            </Field>
          </div>
          <Field label="Status">
            <SelectInput value={filters.status} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, status: event.target.value })) }}>
              <option value="">Todos</option>
              {(Object.keys(statusLabel) as DemandStatus[]).map((status) => (
                <option key={status} value={status}>{statusLabel[status]}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Responsável">
            <SelectInput value={filters.responsibleUserId} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, responsibleUserId: event.target.value })) }}>
              <option value="">Todos</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>{responsible.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cidade">
            <TextInput value={filters.city} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, city: event.target.value })) }} />
          </Field>
          <Field label="Bairro">
            <TextInput value={filters.neighborhood} onChange={(event) => { setPage(1); setFilters((current) => ({ ...current, neighborhood: event.target.value })) }} />
          </Field>
        </div>
      </section>

      {demandsQuery.isLoading ? (
        <div className="app-card p-8 text-center text-slate-400">Carregando demandas...</div>
      ) : demands.length === 0 ? (
        <div className="app-card flex flex-col items-center justify-center py-16 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-slate-300" />
          <div className="text-sm font-medium text-slate-500">Nenhuma demanda encontrada</div>
          <div className="mt-1 text-xs text-slate-400">Cadastre a primeira solicitação recebida pelo gabinete.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {demands.map((demand) => (
            <DemandCard
              key={demand.id}
              demand={demand}
              responsibles={responsibles}
              canDelete={user?.role === 'ADMIN'}
              onStatusChange={(item, status, historyNote, responsibleUserId) => updateMutation.mutate({ demand: item, status, historyNote, responsibleUserId })}
              onDelete={(item) => {
                if (window.confirm(`Excluir a demanda "${item.title}"?`)) deleteMutation.mutate(item)
              }}
            />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-slate-500">
          <button type="button" className="button-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
            Anterior
          </button>
          <span>Página {page} de {data.totalPages}</span>
          <button type="button" className="button-secondary px-3 py-1.5 text-xs" disabled={page >= data.totalPages} onClick={() => setPage((current) => Math.min(current + 1, data.totalPages))}>
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
