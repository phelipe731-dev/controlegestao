import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  FileUp,
  Loader2,
  MapPin,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Field, SelectInput, TextAreaInput, TextInput } from '../components/FormControls'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { formatDate, formatDateTime } from '../lib/format'
import type { CabinetDemand, CabinetDemandHistoryItem, DemandResponsibleUser, DemandStatus, DemandsResponse } from '../types/api'

type DemandFormValues = {
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
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  origin: 'WHATSAPP' | 'PHONE' | 'PRESENTIAL' | 'EMAIL' | 'SOCIAL' | 'OTHER'
  postalCode: string
  street: string
  number: string
  complement: string
  referencePoint: string
}

type DemandFiltersState = {
  search: string
  status: string
  responsibleUserId: string
  city: string
  neighborhood: string
  periodStart: string
  periodEnd: string
}

type FormErrors = Partial<Record<keyof DemandFormValues, string>>
type DrawerTab = 'details' | 'history' | 'attachments'

const initialForm: DemandFormValues = {
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
  priority: 'NORMAL',
  origin: 'WHATSAPP',
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  referencePoint: '',
}

const initialFilters: DemandFiltersState = {
  search: '',
  status: '',
  responsibleUserId: '',
  city: '',
  neighborhood: '',
  periodStart: '',
  periodEnd: '',
}

const demandStatusLabel: Record<DemandStatus, string> = {
  REQUESTED: 'Solicitada',
  IN_PROGRESS: 'Em processo',
  RESOLVED: 'Resolvida',
}

const demandStatusStyles: Record<DemandStatus, string> = {
  REQUESTED: 'border-amber/30 bg-amber/10 text-amber',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  RESOLVED: 'border-teal/30 bg-teal/10 text-teal',
}

const priorityLabel: Record<DemandFormValues['priority'], string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const originLabel: Record<DemandFormValues['origin'], string> = {
  WHATSAPP: 'WhatsApp',
  PHONE: 'Telefone',
  PRESENTIAL: 'Presencial',
  EMAIL: 'E-mail',
  SOCIAL: 'Redes sociais',
  OTHER: 'Outro',
}

function useDebouncedValue<T>(value: T, delayMs = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debounced
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function demandCode(demand: CabinetDemand) {
  return `#DEM-${demand.id.slice(-5).toUpperCase()}`
}

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function relativeUpdate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)

  if (date.toDateString() === today.toDateString()) return `Hoje, ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `Ontem, ${time}`
  return formatDate(value)
}

function isOverdue(demand: CabinetDemand) {
  if (demand.status === 'RESOLVED') return false
  const ageMs = Date.now() - new Date(demand.createdAt).getTime()
  return ageMs > 1000 * 60 * 60 * 24 * 7
}

function mapToPayload(form: DemandFormValues) {
  const addressParts = [
    form.street || form.requesterAddress,
    form.number,
    form.complement,
    form.referencePoint ? `Ref: ${form.referencePoint}` : '',
  ].filter(Boolean)

  const context = [
    `Origem: ${originLabel[form.origin]}`,
    `Prioridade: ${priorityLabel[form.priority]}`,
    form.postalCode ? `CEP: ${form.postalCode}` : '',
  ].filter(Boolean)

  return {
    title: form.title.trim(),
    description: [form.description.trim(), context.length ? `\n\n${context.join(' | ')}` : ''].join(''),
    requesterName: form.requesterName.trim(),
    requesterPhone: form.requesterPhone.trim(),
    requesterAddress: addressParts.join(', ') || form.requesterAddress.trim(),
    requesterCity: form.requesterCity.trim(),
    requesterNeighborhood: form.requesterNeighborhood.trim(),
    responsibleUserId: form.responsibleUserId,
    status: form.status,
    historyNote: form.historyNote.trim() || 'Demanda atualizada pelo gabinete.',
  }
}

function formFromDemand(demand: CabinetDemand): DemandFormValues {
  return {
    ...initialForm,
    title: demand.title,
    description: demand.description,
    requesterName: demand.requesterName,
    requesterPhone: demand.requesterPhone,
    requesterAddress: demand.requesterAddress,
    requesterCity: demand.requesterCity ?? '',
    requesterNeighborhood: demand.requesterNeighborhood ?? '',
    responsibleUserId: demand.responsibleUserId ?? '',
    status: demand.status,
    historyNote: '',
    street: demand.requesterAddress,
  }
}

function validateForm(form: DemandFormValues) {
  const errors: FormErrors = {}
  if (form.title.trim().length < 3) errors.title = 'Informe o título da demanda.'
  if (form.description.trim().length < 3) errors.description = 'Descreva a demanda.'
  if (form.requesterName.trim().length < 3) errors.requesterName = 'Informe o nome do solicitante.'
  if (form.requesterPhone.replace(/\D/g, '').length < 8) errors.requesterPhone = 'Informe um telefone válido.'
  if (!form.requesterAddress.trim() && !form.street.trim()) errors.requesterAddress = 'Informe o endereço do solicitante.'
  return errors
}

function DemandStatusBadge({ status, overdue = false }: { status: DemandStatus; overdue?: boolean }) {
  if (overdue) {
    return <span className="inline-flex rounded-full border border-rose/25 bg-rose/10 px-2.5 py-1 text-xs font-semibold text-rose">Atrasada</span>
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${demandStatusStyles[status]}`}>
      {demandStatusLabel[status]}
    </span>
  )
}

function DemandSummaryCards({
  data,
  demands,
  activeStatus,
  onFilter,
}: {
  data?: DemandsResponse
  demands: CabinetDemand[]
  activeStatus: string
  onFilter: (status: string) => void
}) {
  const overdueCount = demands.filter(isOverdue).length
  const cards = [
    { key: 'REQUESTED', label: 'Solicitadas', helper: 'Aguardando início', value: data?.metrics.requested ?? 0, icon: AlertTriangle, classes: 'bg-amber/10 text-amber border-amber/20' },
    { key: 'IN_PROGRESS', label: 'Em processo', helper: 'Em andamento', value: data?.metrics.inProgress ?? 0, icon: Clock3, classes: 'bg-blue-50 text-blue-700 border-blue-100' },
    { key: 'RESOLVED', label: 'Resolvidas', helper: 'Concluídas', value: data?.metrics.resolved ?? 0, icon: CheckCircle2, classes: 'bg-teal/10 text-teal border-teal/20' },
    { key: 'OVERDUE', label: 'Atrasadas', helper: 'Precisam de atenção', value: overdueCount, icon: AlertTriangle, classes: 'bg-rose/10 text-rose border-rose/20' },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        const active = activeStatus === card.key
        return (
          <button
            key={card.key}
            type="button"
            className={`app-card flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card-md ${active ? 'ring-2 ring-teal/30' : ''}`}
            onClick={() => onFilter(active ? '' : card.key)}
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl border ${card.classes}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs font-semibold text-slate-500">{card.helper}</span>
              <span className="mt-0.5 block font-display text-2xl font-bold text-ink">{card.value}</span>
              <span className="block text-sm font-semibold text-slate-700">{card.label}</span>
            </span>
          </button>
        )
      })}
    </section>
  )
}

function DemandFilters({
  filters,
  responsibles,
  onChange,
  onClear,
}: {
  filters: DemandFiltersState
  responsibles: DemandResponsibleUser[]
  onChange: (filters: DemandFiltersState) => void
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="app-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Field label="Buscar">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput
                className="pl-9"
                value={filters.search}
                onChange={(event) => onChange({ ...filters, search: event.target.value })}
                placeholder="Buscar demanda, solicitante ou telefone..."
              />
            </div>
          </Field>
        </div>
        <button type="button" className="button-secondary" onClick={() => setExpanded((current) => !current)}>
          Filtros
          <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Field label="Status">
            <SelectInput value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
              <option value="">Todos</option>
              <option value="REQUESTED">Solicitada</option>
              <option value="IN_PROGRESS">Em processo</option>
              <option value="RESOLVED">Resolvida</option>
              <option value="OVERDUE">Atrasada</option>
            </SelectInput>
          </Field>
          <Field label="Responsável">
            <SelectInput value={filters.responsibleUserId} onChange={(event) => onChange({ ...filters, responsibleUserId: event.target.value })}>
              <option value="">Todos</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>{responsible.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cidade">
            <TextInput value={filters.city} onChange={(event) => onChange({ ...filters, city: event.target.value })} />
          </Field>
          <Field label="Bairro">
            <TextInput value={filters.neighborhood} onChange={(event) => onChange({ ...filters, neighborhood: event.target.value })} />
          </Field>
          <Field label="Início">
            <TextInput type="date" value={filters.periodStart} onChange={(event) => onChange({ ...filters, periodStart: event.target.value })} />
          </Field>
          <Field label="Fim">
            <TextInput type="date" value={filters.periodEnd} onChange={(event) => onChange({ ...filters, periodEnd: event.target.value })} />
          </Field>
          <div className="sm:col-span-2 xl:col-span-6">
            <button type="button" className="text-sm font-semibold text-teal hover:text-teal-dark" onClick={onClear}>
              Limpar filtros
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function DemandPagination({ page, data, onPage }: { page: number; data?: DemandsResponse; onPage: (page: number) => void }) {
  if (!data) return null
  const from = data.total === 0 ? 0 : (page - 1) * data.limit + 1
  const to = Math.min(page * data.limit, data.total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>Mostrando {from} a {to} de {data.total} demandas</span>
      <div className="flex items-center gap-2">
        <button type="button" className="button-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => onPage(Math.max(page - 1, 1))}>
          Anterior
        </button>
        <span className="text-xs">Página {page} de {data.totalPages}</span>
        <button type="button" className="button-secondary px-3 py-1.5 text-xs" disabled={page >= data.totalPages} onClick={() => onPage(Math.min(page + 1, data.totalPages))}>
          Próxima
        </button>
      </div>
    </div>
  )
}

function ResponsibleAvatar({ name }: { name?: string | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
        {initials(name)}
      </span>
      <span className="font-medium text-ink">{name ?? 'Não definido'}</span>
    </span>
  )
}

function DemandTable({
  demands,
  responsibles,
  updatingId,
  onSelect,
  onEdit,
  onDelete,
  onQuickUpdate,
  canDelete,
}: {
  demands: CabinetDemand[]
  responsibles: DemandResponsibleUser[]
  updatingId: string | null
  onSelect: (demand: CabinetDemand) => void
  onEdit: (demand: CabinetDemand) => void
  onDelete: (demand: CabinetDemand) => void
  onQuickUpdate: (demand: CabinetDemand, payload: { status?: DemandStatus; responsibleUserId?: string; historyNote?: string }) => void
  canDelete: boolean
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="crm-table">
        <thead>
          <tr>
            <th>Demanda</th>
            <th>Solicitante</th>
            <th>Localização</th>
            <th>Status</th>
            <th>Responsável</th>
            <th>Atualização</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {demands.map((demand) => (
            <tr key={demand.id} className="cursor-pointer" onClick={() => onSelect(demand)}>
              <td>
                <div className="font-semibold text-ink">{demand.title}</div>
                <div className="mt-0.5 text-xs text-slate-400">{demandCode(demand)}</div>
              </td>
              <td>
                <div className="font-medium text-ink">{demand.requesterName}</div>
                <div className="mt-0.5 text-xs text-slate-400">{demand.requesterPhone}</div>
              </td>
              <td>
                <div className="font-medium text-ink">{demand.requesterNeighborhood ?? 'Sem bairro'}</div>
                <div className="mt-0.5 text-xs text-slate-400">{[demand.requesterCity, 'SP'].filter(Boolean).join(' · ')}</div>
              </td>
              <td onClick={(event) => event.stopPropagation()}>
                {updatingId === demand.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-teal" />
                ) : (
                  <SelectInput
                    className="min-w-[140px] py-1.5 text-xs"
                    value={demand.status}
                    onChange={(event) => onQuickUpdate(demand, { status: event.target.value as DemandStatus, historyNote: 'Status alterado pela tabela.' })}
                  >
                    {(Object.keys(demandStatusLabel) as DemandStatus[]).map((status) => (
                      <option key={status} value={status}>{demandStatusLabel[status]}</option>
                    ))}
                  </SelectInput>
                )}
              </td>
              <td onClick={(event) => event.stopPropagation()}>
                <SelectInput
                  className="min-w-[180px] py-1.5 text-xs"
                  value={demand.responsibleUserId ?? ''}
                  onChange={(event) => onQuickUpdate(demand, { responsibleUserId: event.target.value, historyNote: 'Responsável alterado pela tabela.' })}
                >
                  <option value="">Não definido</option>
                  {responsibles.map((responsible) => (
                    <option key={responsible.id} value={responsible.id}>{responsible.name}</option>
                  ))}
                </SelectInput>
              </td>
              <td className="text-sm text-slate-500">{relativeUpdate(demand.updatedAt)}</td>
              <td onClick={(event) => event.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <button type="button" className="button-ghost px-2.5 py-1.5" aria-label="Visualizar demanda" onClick={() => onSelect(demand)}>
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  <button type="button" className="button-ghost px-2.5 py-1.5" onClick={() => onEdit(demand)}>
                    Editar
                  </button>
                  <button type="button" className="button-ghost px-2.5 py-1.5" onClick={() => onQuickUpdate(demand, { status: 'RESOLVED', historyNote: 'Demanda marcada como resolvida.' })}>
                    Resolver
                  </button>
                  {canDelete && (
                    <button type="button" className="button-ghost px-2.5 py-1.5 text-rose hover:bg-rose/10" aria-label="Excluir demanda" onClick={() => onDelete(demand)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DemandMobileCard({
  demand,
  onSelect,
}: {
  demand: CabinetDemand
  onSelect: (demand: CabinetDemand) => void
}) {
  return (
    <button type="button" className="app-card w-full p-4 text-left lg:hidden" onClick={() => onSelect(demand)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">{demand.title}</div>
          <div className="mt-0.5 text-xs text-slate-400">{demandCode(demand)}</div>
        </div>
        <DemandStatusBadge status={demand.status} overdue={isOverdue(demand)} />
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold text-slate-400">Solicitante</div>
          <div className="font-medium text-ink">{demand.requesterName}</div>
          <div>{demand.requesterPhone}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-400">Responsável</div>
          <div>{demand.responsibleUserName ?? 'Não definido'}</div>
          <div className="text-xs text-slate-400">{relativeUpdate(demand.updatedAt)}</div>
        </div>
      </div>
    </button>
  )
}

function DemandEmptyState({
  filtered,
  onCreate,
  onClear,
}: {
  filtered: boolean
  onCreate: () => void
  onClear: () => void
}) {
  return (
    <div className="app-card flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-slate-300" />
      <div className="text-sm font-semibold text-slate-600">{filtered ? 'Nenhuma demanda encontrada' : 'Nenhuma demanda cadastrada'}</div>
      <div className="mt-1 max-w-sm text-xs text-slate-400">
        {filtered ? 'Tente alterar os filtros ou os termos da busca.' : 'Cadastre a primeira solicitação recebida pelo gabinete.'}
      </div>
      <button type="button" className="button-primary mt-4" onClick={filtered ? onClear : onCreate}>
        {filtered ? 'Limpar filtros' : 'Cadastrar primeira demanda'}
      </button>
    </div>
  )
}

function DemandHistoryTimeline({
  historyItems,
  note,
  onNote,
  onSubmit,
  saving,
}: {
  historyItems: CabinetDemandHistoryItem[]
  note: string
  onNote: (value: string) => void
  onSubmit: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {historyItems.map((item) => (
          <div key={item.id} className="relative border-l-2 border-slate-200 pl-4">
            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-teal" />
            <div className="text-xs font-semibold text-slate-400">{formatDateTime(item.createdAt)}</div>
            <div className="mt-1 font-semibold text-ink">{item.updatedByUserName}</div>
            <div className="mt-1 text-sm text-slate-600">
              {item.previousStatus ? `${demandStatusLabel[item.previousStatus]} -> ` : ''}
              {demandStatusLabel[item.nextStatus]}
            </div>
            {item.note && <p className="mt-1 text-sm text-slate-500">{item.note}</p>}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <Field label="Adicionar atualização ao histórico">
          <TextAreaInput value={note} onChange={(event) => onNote(event.target.value)} placeholder="Digite uma observação sobre o andamento da demanda" />
        </Field>
        <button type="button" className="button-primary mt-3" disabled={saving || !note.trim()} onClick={onSubmit}>
          {saving ? 'Registrando...' : 'Registrar atualização'}
        </button>
      </div>
    </div>
  )
}

function DemandAttachments() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <FileUp className="mx-auto h-8 w-8 text-slate-300" />
        <div className="mt-3 font-semibold text-ink">Anexos preparados para a próxima etapa</div>
        <p className="mt-1 text-sm text-slate-500">
          O backend atual ainda não possui endpoint de upload. A área visual foi preparada sem alterar a API existente.
        </p>
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-3 text-sm text-slate-500">
        Nome, tamanho, tipo, data e usuário serão exibidos aqui quando o armazenamento de anexos for habilitado.
      </div>
    </div>
  )
}

function DemandDetailsDrawer({
  demand,
  responsibles,
  activeTab,
  historyNote,
  saving,
  onTab,
  onClose,
  onEdit,
  onHistoryNote,
  onHistorySubmit,
  onUpdateStatus,
}: {
  demand: CabinetDemand | null
  responsibles: DemandResponsibleUser[]
  activeTab: DrawerTab
  historyNote: string
  saving: boolean
  onTab: (tab: DrawerTab) => void
  onClose: () => void
  onEdit: (demand: CabinetDemand) => void
  onHistoryNote: (value: string) => void
  onHistorySubmit: () => void
  onUpdateStatus: (status: DemandStatus, note: string, responsibleUserId?: string) => void
}) {
  if (!demand) return null
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(demand.requesterAddress)}`
  const whatsappUrl = `https://wa.me/55${demand.requesterPhone.replace(/\D/g, '')}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm">
      <button type="button" className="flex-1" aria-label="Fechar detalhes da demanda" onClick={onClose} />
      <aside className="flex h-full w-full flex-col bg-white shadow-2xl sm:w-[70vw] lg:w-[480px]">
        <header className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">Demanda {demandCode(demand)}</h2>
                <DemandStatusBadge status={demand.status} overdue={isOverdue(demand)} />
              </div>
              <p className="mt-1 text-sm text-slate-500">Solicitada em {formatDateTime(demand.createdAt)}</p>
            </div>
            <button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink" aria-label="Fechar" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm font-semibold text-slate-500">
            {[
              ['details', 'Detalhes'],
              ['history', 'Histórico'],
              ['attachments', 'Anexos'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg px-3 py-2 transition ${activeTab === key ? 'bg-white text-ink shadow-sm' : 'hover:text-ink'}`}
                onClick={() => onTab(key as DrawerTab)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'details' && (
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="section-label">Descrição</div>
                  <Edit3 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{demand.description}</p>
              </section>

              <section className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="section-label">Responsável</div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 text-sm font-bold text-teal">{initials(demand.responsibleUserName)}</span>
                  <div>
                    <div className="font-semibold text-ink">{demand.responsibleUserName ?? 'Não definido'}</div>
                    <div className="text-xs text-slate-400">Equipe do gabinete</div>
                  </div>
                </div>
                <SelectInput className="mt-3" value={demand.responsibleUserId ?? ''} onChange={(event) => onUpdateStatus(demand.status, 'Responsável alterado nos detalhes.', event.target.value)}>
                  <option value="">Não definido</option>
                  {responsibles.map((responsible) => (
                    <option key={responsible.id} value={responsible.id}>{responsible.name}</option>
                  ))}
                </SelectInput>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="section-label">Solicitante</div>
                  <div className="mt-2 font-semibold text-ink">{demand.requesterName}</div>
                  <div className="text-sm text-slate-500">{demand.requesterPhone}</div>
                  <div className="mt-3 flex gap-2">
                    <a className="button-secondary px-3 py-1.5 text-xs" href={`tel:${demand.requesterPhone}`}>
                      <Phone className="h-3.5 w-3.5" />
                      Ligar
                    </a>
                    <a className="button-secondary px-3 py-1.5 text-xs" href={whatsappUrl} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="section-label">Localização</div>
                  <div className="mt-2 font-semibold text-ink">{demand.requesterAddress}</div>
                  <div className="text-sm text-slate-500">{[demand.requesterNeighborhood, demand.requesterCity, 'SP'].filter(Boolean).join(' · ')}</div>
                  <a className="button-secondary mt-3 px-3 py-1.5 text-xs" href={mapUrl} target="_blank" rel="noreferrer">
                    <MapPin className="h-3.5 w-3.5" />
                    Abrir mapa
                  </a>
                </div>
              </section>

              <section className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="section-label">Informações adicionais</div>
                <div className="mt-3 grid gap-3 text-sm text-slate-600">
                  <div className="flex justify-between gap-3"><span>Quem recebeu</span><strong className="text-ink">{demand.createdByUserName}</strong></div>
                  <div className="flex justify-between gap-3"><span>Prioridade</span><strong className="text-ink">Normal</strong></div>
                  <div className="flex justify-between gap-3"><span>Criação</span><strong className="text-ink">{formatDateTime(demand.createdAt)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Última atualização</span><strong className="text-ink">{formatDateTime(demand.updatedAt)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Quando foi sanada</span><strong className="text-ink">{demand.resolvedAt ? formatDateTime(demand.resolvedAt) : 'Pendente'}</strong></div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <DemandHistoryTimeline
              historyItems={demand.history}
              note={historyNote}
              onNote={onHistoryNote}
              onSubmit={onHistorySubmit}
              saving={saving}
            />
          )}

          {activeTab === 'attachments' && <DemandAttachments />}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white p-4">
          <button type="button" className="button-secondary" onClick={() => onEdit(demand)}>
            Editar
          </button>
          <button type="button" className="button-primary" disabled={saving} onClick={() => onUpdateStatus('RESOLVED', 'Demanda marcada como resolvida pelos detalhes.')}>
            Atualizar status
          </button>
        </footer>
      </aside>
    </div>
  )
}

function DemandFormDrawer({
  open,
  editingDemand,
  form,
  errors,
  responsibles,
  saving,
  firstErrorField,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  editingDemand: CabinetDemand | null
  form: DemandFormValues
  errors: FormErrors
  responsibles: DemandResponsibleUser[]
  saving: boolean
  firstErrorField: keyof DemandFormValues | null
  onChange: (form: DemandFormValues) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const refs = {
    title: useRef<HTMLInputElement>(null),
    description: useRef<HTMLTextAreaElement>(null),
    requesterName: useRef<HTMLInputElement>(null),
    requesterPhone: useRef<HTMLInputElement>(null),
    requesterAddress: useRef<HTMLInputElement>(null),
  }

  useEffect(() => {
    if (!firstErrorField) return
    const ref = refs[firstErrorField as keyof typeof refs]
    ref?.current?.focus()
  }, [firstErrorField])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-sm">
      <button type="button" className="flex-1" aria-label="Cancelar cadastro de demanda" onClick={onClose} />
      <aside className="flex h-full w-full flex-col bg-white shadow-2xl sm:w-[75vw] xl:w-[560px]">
        <header className="border-b border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-ink">{editingDemand ? 'Editar demanda' : 'Nova demanda'}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {editingDemand ? 'Atualize os dados da solicitação.' : 'Cadastre uma nova solicitação recebida pelo gabinete.'}
              </p>
            </div>
            <button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink" aria-label="Fechar formulário" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-6">
            <section>
              <div className="section-label">Dados da demanda</div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Título da demanda *" error={errors.title}>
                    <TextInput ref={refs.title} value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="Ex.: manutenção de iluminação" error={errors.title} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Descrição *" error={errors.description}>
                    <TextAreaInput ref={refs.description} value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} placeholder="Descreva a solicitação" />
                  </Field>
                </div>
                <Field label="Status">
                  <SelectInput value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as DemandStatus })}>
                    {(Object.keys(demandStatusLabel) as DemandStatus[]).map((status) => (
                      <option key={status} value={status}>{demandStatusLabel[status]}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Prioridade">
                  <SelectInput value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value as DemandFormValues['priority'] })}>
                    {(Object.keys(priorityLabel) as DemandFormValues['priority'][]).map((priority) => (
                      <option key={priority} value={priority}>{priorityLabel[priority]}</option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Responsável">
                    <SelectInput value={form.responsibleUserId} onChange={(event) => onChange({ ...form, responsibleUserId: event.target.value })}>
                      <option value="">Usuário atual</option>
                      {responsibles.map((responsible) => (
                        <option key={responsible.id} value={responsible.id}>{responsible.name}</option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
              </div>
            </section>

            <section>
              <div className="section-label">Solicitante</div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Nome do solicitante *" error={errors.requesterName}>
                  <TextInput ref={refs.requesterName} value={form.requesterName} onChange={(event) => onChange({ ...form, requesterName: event.target.value })} error={errors.requesterName} />
                </Field>
                <Field label="Telefone *" error={errors.requesterPhone}>
                  <TextInput ref={refs.requesterPhone} value={form.requesterPhone} onChange={(event) => onChange({ ...form, requesterPhone: maskPhone(event.target.value) })} error={errors.requesterPhone} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Origem da solicitação">
                    <SelectInput value={form.origin} onChange={(event) => onChange({ ...form, origin: event.target.value as DemandFormValues['origin'] })}>
                      {(Object.keys(originLabel) as DemandFormValues['origin'][]).map((origin) => (
                        <option key={origin} value={origin}>{originLabel[origin]}</option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
              </div>
            </section>

            <section>
              <div className="section-label">Localização</div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="CEP">
                  <TextInput value={form.postalCode} onChange={(event) => onChange({ ...form, postalCode: event.target.value })} />
                </Field>
                <Field label="Cidade">
                  <TextInput value={form.requesterCity} onChange={(event) => onChange({ ...form, requesterCity: event.target.value })} />
                </Field>
                <Field label="Bairro">
                  <TextInput value={form.requesterNeighborhood} onChange={(event) => onChange({ ...form, requesterNeighborhood: event.target.value })} />
                </Field>
                <Field label="Rua">
                  <TextInput value={form.street} onChange={(event) => onChange({ ...form, street: event.target.value, requesterAddress: [event.target.value, form.number].filter(Boolean).join(', ') })} />
                </Field>
                <Field label="Número">
                  <TextInput value={form.number} onChange={(event) => onChange({ ...form, number: event.target.value, requesterAddress: [form.street, event.target.value].filter(Boolean).join(', ') })} />
                </Field>
                <Field label="Complemento">
                  <TextInput value={form.complement} onChange={(event) => onChange({ ...form, complement: event.target.value })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Endereço completo *" error={errors.requesterAddress}>
                    <TextInput ref={refs.requesterAddress} value={form.requesterAddress} onChange={(event) => onChange({ ...form, requesterAddress: event.target.value })} error={errors.requesterAddress} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Ponto de referência">
                    <TextInput value={form.referencePoint} onChange={(event) => onChange({ ...form, referencePoint: event.target.value })} />
                  </Field>
                </div>
              </div>
            </section>

            <section>
              <div className="section-label">Informações internas</div>
              <div className="mt-3 space-y-4">
                <Field label="Observação interna">
                  <TextAreaInput value={form.historyNote} onChange={(event) => onChange({ ...form, historyNote: event.target.value })} placeholder="Ex.: solicitação recebida por WhatsApp" />
                </Field>
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <Paperclip className="h-4 w-4" />
                    Anexos
                  </div>
                  <p className="mt-1">Upload visual preparado. A persistência será habilitada quando existir endpoint de anexos.</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white p-4">
          <button type="button" className="button-secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="button-primary" disabled={saving} onClick={onSubmit}>
            {saving ? 'Salvando...' : 'Salvar demanda'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

function DemandSkeleton() {
  return (
    <div className="app-card overflow-hidden">
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  )
}

export function DemandsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<DemandFiltersState>(initialFilters)
  const [selectedDemand, setSelectedDemand] = useState<CabinetDemand | null>(null)
  const [detailsTab, setDetailsTab] = useState<DrawerTab>('details')
  const [formOpen, setFormOpen] = useState(false)
  const [editingDemand, setEditingDemand] = useState<CabinetDemand | null>(null)
  const [form, setForm] = useState<DemandFormValues>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [firstErrorField, setFirstErrorField] = useState<keyof DemandFormValues | null>(null)
  const [historyNote, setHistoryNote] = useState('')
  const [toast, setToast] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(filters.search)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const apiFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch,
  }), [debouncedSearch, filters])

  const params = useMemo(() => {
    const searchParams = new URLSearchParams({ page: String(page), limit: '25' })
    Object.entries(apiFilters).forEach(([key, value]) => {
      if (!value) return
      if (key === 'status' && value === 'OVERDUE') return
      if (key === 'periodStart' || key === 'periodEnd') return
      searchParams.set(key, value)
    })
    return searchParams.toString()
  }, [apiFilters, page])

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
    mutationFn: async (values: DemandFormValues) => {
      const payload = mapToPayload(values)
      const response = editingDemand
        ? await api.patch(`/demands/${editingDemand.id}`, payload)
        : await api.post('/demands', payload)
      return response.data
    },
    onSuccess: async ({ demand }: { demand: CabinetDemand }) => {
      setToast(editingDemand ? 'Demanda atualizada com sucesso.' : 'Demanda cadastrada com sucesso.')
      setFormOpen(false)
      setEditingDemand(null)
      setForm(initialForm)
      setErrors({})
      setSelectedDemand(demand)
      await queryClient.invalidateQueries({ queryKey: ['demands'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ demand, payload }: { demand: CabinetDemand; payload: { status?: DemandStatus; responsibleUserId?: string; historyNote?: string } }) => {
      setUpdatingId(demand.id)
      const response = await api.patch(`/demands/${demand.id}`, payload)
      return response.data
    },
    onSuccess: async ({ demand }: { demand: CabinetDemand }) => {
      setToast('Demanda atualizada.')
      setSelectedDemand(demand)
      setHistoryNote('')
      await queryClient.invalidateQueries({ queryKey: ['demands'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
    onSettled: () => setUpdatingId(null),
  })

  const deleteMutation = useMutation({
    mutationFn: async (demand: CabinetDemand) => {
      await api.delete(`/demands/${demand.id}`)
    },
    onSuccess: async () => {
      setToast('Demanda excluída.')
      setSelectedDemand(null)
      await queryClient.invalidateQueries({ queryKey: ['demands'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const data = demandsQuery.data
  const responsibles = responsiblesQuery.data ?? []
  const rawDemands = data?.demands ?? []
  const filteredDemands = rawDemands.filter((demand) => {
    if (filters.status === 'OVERDUE' && !isOverdue(demand)) return false
    if (filters.periodStart && new Date(demand.createdAt) < new Date(filters.periodStart)) return false
    if (filters.periodEnd && new Date(demand.createdAt) > new Date(`${filters.periodEnd}T23:59:59`)) return false
    return true
  })
  const hasFilters = Object.values(filters).some(Boolean)

  function openCreate() {
    setEditingDemand(null)
    setForm({ ...initialForm, responsibleUserId: user?.id ?? '' })
    setErrors({})
    setFirstErrorField(null)
    setFormOpen(true)
  }

  function openEdit(demand: CabinetDemand) {
    setEditingDemand(demand)
    setForm(formFromDemand(demand))
    setErrors({})
    setFirstErrorField(null)
    setFormOpen(true)
  }

  function submitForm() {
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    const first = Object.keys(nextErrors)[0] as keyof DemandFormValues | undefined
    setFirstErrorField(first ?? null)
    if (first) return
    createMutation.mutate(form)
  }

  function quickUpdate(demand: CabinetDemand, payload: { status?: DemandStatus; responsibleUserId?: string; historyNote?: string }) {
    updateMutation.mutate({ demand, payload })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="section-label">Gabinete</div>
          <h2 className="page-title mt-1">Demandas</h2>
          <p className="page-subtitle mt-1">Solicitações recebidas pelo gabinete</p>
        </div>
        <button type="button" className="button-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova demanda
        </button>
      </div>

      <DemandSummaryCards
        data={data}
        demands={rawDemands}
        activeStatus={filters.status}
        onFilter={(status) => {
          setPage(1)
          setFilters((current) => ({ ...current, status }))
        }}
      />

      <DemandFilters
        filters={filters}
        responsibles={responsibles}
        onChange={(next) => {
          setPage(1)
          setFilters(next)
        }}
        onClear={() => {
          setPage(1)
          setFilters(initialFilters)
        }}
      />

      {demandsQuery.isError ? (
        <div className="app-card p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose" />
          <div className="mt-3 font-semibold text-ink">Não foi possível carregar as demandas.</div>
          <button type="button" className="button-primary mt-4" onClick={() => demandsQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : demandsQuery.isLoading ? (
        <DemandSkeleton />
      ) : filteredDemands.length === 0 ? (
        <DemandEmptyState filtered={hasFilters} onCreate={openCreate} onClear={() => setFilters(initialFilters)} />
      ) : (
        <section className="app-card overflow-hidden">
          <DemandTable
            demands={filteredDemands}
            responsibles={responsibles}
            updatingId={updatingId}
            canDelete={user?.role === 'ADMIN'}
            onSelect={(demand) => {
              setSelectedDemand(demand)
              setDetailsTab('details')
            }}
            onEdit={openEdit}
            onDelete={(demand) => {
              if (window.confirm(`Excluir a demanda "${demand.title}"?`)) deleteMutation.mutate(demand)
            }}
            onQuickUpdate={quickUpdate}
          />
          <div className="space-y-3 p-3 lg:hidden">
            {filteredDemands.map((demand) => (
              <DemandMobileCard key={demand.id} demand={demand} onSelect={(item) => setSelectedDemand(item)} />
            ))}
          </div>
          <DemandPagination page={page} data={data} onPage={setPage} />
        </section>
      )}

      <DemandDetailsDrawer
        demand={selectedDemand}
        responsibles={responsibles}
        activeTab={detailsTab}
        historyNote={historyNote}
        saving={updateMutation.isPending}
        onTab={setDetailsTab}
        onClose={() => setSelectedDemand(null)}
        onEdit={openEdit}
        onHistoryNote={setHistoryNote}
        onHistorySubmit={() => selectedDemand && quickUpdate(selectedDemand, { historyNote })}
        onUpdateStatus={(status, note, responsibleUserId) => selectedDemand && quickUpdate(selectedDemand, { status, historyNote: note, responsibleUserId })}
      />

      <DemandFormDrawer
        open={formOpen}
        editingDemand={editingDemand}
        form={form}
        errors={errors}
        responsibles={responsibles}
        saving={createMutation.isPending}
        firstErrorField={firstErrorField}
        onChange={setForm}
        onClose={() => {
          setFormOpen(false)
          setEditingDemand(null)
        }}
        onSubmit={submitForm}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] rounded-xl border border-teal/20 bg-white px-4 py-3 text-sm font-semibold text-teal shadow-card-md">
          {toast}
        </div>
      )}
    </div>
  )
}
