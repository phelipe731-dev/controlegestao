import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, UserCheck, ArrowLeftRight, ShieldOff, Trash2, Pencil } from 'lucide-react'
import { CheckboxInput, Field, SelectInput, TextAreaInput, TextInput } from '../components/FormControls'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { cpfMask, formatDateTime, statusLabel, toInputDate } from '../lib/format'
import type { ConsentSource, Leader, Supporter, SupporterStatus } from '../types/api'

type SupporterFormValues = {
  fullName: string
  cpf: string
  phone: string
  birthDate: string
  postalCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  voterRegistration: string
  electoralZone: string
  electoralSection: string
  leaderId: string
  notes: string
  consentAccepted: boolean
  consentSource: ConsentSource
  status: SupporterStatus
}

type SupporterFilters = {
  search: string
  leaderId: string
  city: string
  neighborhood: string
  electoralZone: string
  status: string
}

const initialForm: SupporterFormValues = {
  fullName: '',
  cpf: '',
  phone: '',
  birthDate: '',
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: 'SP',
  voterRegistration: '',
  electoralZone: '',
  electoralSection: '',
  leaderId: '',
  notes: '',
  consentAccepted: false,
  consentSource: 'WEB_FORM',
  status: 'ACTIVE',
}

export function SupporterListPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [filters, setFilters] = useState<SupporterFilters>({
    search: '',
    leaderId: '',
    city: '',
    neighborhood: '',
    electoralZone: '',
    status: '',
  })
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)

  const { data: leaders } = useQuery({
    queryKey: ['leaders-options'],
    queryFn: async () => {
      const response = await api.get<{ leaders: Leader[] }>('/leaders')
      return response.data.leaders
    },
    enabled: user?.role !== 'LEADER',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['supporters', filters, page],
    queryFn: async () => {
      const response = await api.get<{
        supporters: Supporter[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>('/supporters', { params: { ...filters, page, limit: pageSize } })
      return response.data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/supporters/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const transferMutation = useMutation({
    mutationFn: async ({ supporterId, leaderId }: { supporterId: string; leaderId: string }) => {
      await api.post(`/supporters/${supporterId}/transfer`, { leaderId })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const anonymizeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/supporters/${id}/anonymize`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const supporters = data?.supporters ?? []
  const totalSupporters = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const canWrite = user?.role === 'ADMIN' || user?.role === 'LEADER'
  const activeFilters = Object.values(filters).filter(Boolean).length
  const updateFilters = (updater: (current: SupporterFilters) => SupporterFilters) => {
    setPage(1)
    setFilters(updater)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field-base pl-9"
            placeholder="Buscar por nome, CPF ou título..."
            value={filters.search}
            onChange={(e) => updateFilters((c) => ({ ...c, search: e.target.value }))}
          />
        </div>

        {/* Filters toggle */}
        <button
          type="button"
          onClick={() => setShowFilters((c) => !c)}
          className={`button-secondary relative ${showFilters ? 'border-teal text-teal' : ''}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {activeFilters > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal text-[10px] font-bold text-white">
              {activeFilters}
            </span>
          )}
        </button>

        {canWrite && (
          <Link to="/supporters/new" className="button-primary ml-auto">
            <Plus className="h-4 w-4" />
            Novo apoiador
          </Link>
        )}
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="app-card p-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {user?.role !== 'LEADER' && (
              <Field label="Líder">
                <SelectInput value={filters.leaderId} onChange={(e) => updateFilters((c) => ({ ...c, leaderId: e.target.value }))}>
                  <option value="">Todos</option>
                  {(leaders ?? []).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </SelectInput>
              </Field>
            )}
            <Field label="Cidade">
              <TextInput value={filters.city} onChange={(e) => updateFilters((c) => ({ ...c, city: e.target.value }))} placeholder="Ex: São Paulo" />
            </Field>
            <Field label="Bairro">
              <TextInput value={filters.neighborhood} onChange={(e) => updateFilters((c) => ({ ...c, neighborhood: e.target.value }))} />
            </Field>
            <Field label="Zona eleitoral">
              <TextInput value={filters.electoralZone} onChange={(e) => updateFilters((c) => ({ ...c, electoralZone: e.target.value }))} />
            </Field>
            <Field label="Status">
              <SelectInput value={filters.status} onChange={(e) => updateFilters((c) => ({ ...c, status: e.target.value }))}>
                <option value="">Todos</option>
                <option value="ACTIVE">Ativo</option>
                <option value="ARCHIVED">Arquivado</option>
                <option value="ANONYMIZED">Anonimizado</option>
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="button-ghost text-xs"
              onClick={() => {
                setPage(1)
                setFilters({ search: '', leaderId: '', city: '', neighborhood: '', electoralZone: '', status: '' })
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="app-card overflow-hidden">
        {isLoading && (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-4">
                <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && supporters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="mb-3 h-10 w-10 text-slate-300" />
            <div className="text-sm font-medium text-slate-500">Nenhum apoiador encontrado</div>
            <div className="mt-1 text-xs text-slate-400">Tente ajustar os filtros ou cadastre um novo apoiador.</div>
          </div>
        )}

        {supporters.length > 0 && (
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Apoiador</th>
                  <th>Localização</th>
                  <th>Zona / Seção</th>
                  <th>Líder</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {supporters.map((supporter) => (
                  <tr key={supporter.id}>
                    <td>
                      <div className="font-medium text-ink">{supporter.fullName}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {cpfMask(supporter.cpf)} · {supporter.phone || 'Sem telefone'}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm text-ink">{supporter.city}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{supporter.neighborhood}</div>
                    </td>
                    <td>
                      <div className="text-sm">Zona {supporter.electoralZone}</div>
                      <div className="mt-0.5 text-xs text-slate-400">Seção {supporter.electoralSection}</div>
                    </td>
                    <td>
                      <div className="text-sm text-ink">{supporter.leaderName}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{supporter.supervisorName ?? '—'}</div>
                    </td>
                    <td>
                      <StatusPill value={supporter.status} />
                    </td>
                    <td className="text-xs text-slate-400">{formatDateTime(supporter.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {user?.role !== 'SUPERVISOR' && (
                          <Link to={`/supporters/${supporter.id}/edit`} className="button-ghost px-2.5 py-1.5">
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Editar</span>
                          </Link>
                        )}
                        {user?.role === 'ADMIN' && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <SelectInput
                                className="min-w-[160px] py-1.5 text-xs"
                                value={transferTarget[supporter.id] ?? ''}
                                onChange={(e) => setTransferTarget((c) => ({ ...c, [supporter.id]: e.target.value }))}
                              >
                                <option value="">Transferir para...</option>
                                {(leaders ?? []).map((l) => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </SelectInput>
                              <button
                                type="button"
                                title="Confirmar transferência"
                                className="button-ghost px-2.5 py-1.5"
                                onClick={() => {
                                  const leaderId = transferTarget[supporter.id]
                                  if (!leaderId) { alert('Selecione o novo líder antes de transferir.'); return }
                                  transferMutation.mutate({ supporterId: supporter.id, leaderId })
                                }}
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              title="Anonimizar"
                              className="button-ghost px-2.5 py-1.5 text-amber hover:bg-amber/10 hover:text-amber"
                              onClick={() => { if (window.confirm(`Anonimizar o cadastro de ${supporter.fullName}?`)) anonymizeMutation.mutate(supporter.id) }}
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Excluir"
                              className="button-ghost px-2.5 py-1.5 text-rose hover:bg-rose/10 hover:text-rose"
                              onClick={() => { if (window.confirm(`Excluir o cadastro de ${supporter.fullName}?`)) deleteMutation.mutate(supporter.id) }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
              <span>
                Exibindo {supporters.length} de {totalSupporters} registro{totalSupporters !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="button-secondary px-3 py-1.5 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Anterior
                </button>
                <span>
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  className="button-secondary px-3 py-1.5 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SupporterFormPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)

  const form = useForm<SupporterFormValues>({ defaultValues: initialForm })

  const { data: leaders } = useQuery({
    queryKey: ['leaders-options-form'],
    queryFn: async () => {
      const response = await api.get<{ leaders: Leader[] }>('/leaders')
      return response.data.leaders
    },
    enabled: user?.role === 'ADMIN',
  })

  const { data: supporterData, isLoading } = useQuery({
    queryKey: ['supporter', id],
    queryFn: async () => {
      const response = await api.get<{ supporter: Supporter }>(`/supporters/${id}`)
      return response.data.supporter
    },
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (!supporterData) {
      if (user?.role === 'LEADER' && user.leaderId) form.setValue('leaderId', user.leaderId)
      return
    }
    form.reset({
      fullName: supporterData.fullName,
      cpf: supporterData.cpf,
      phone: supporterData.phone ?? '',
      birthDate: toInputDate(supporterData.birthDate),
      postalCode: supporterData.postalCode,
      street: supporterData.street,
      number: supporterData.number,
      complement: supporterData.complement ?? '',
      neighborhood: supporterData.neighborhood,
      city: supporterData.city,
      state: supporterData.state,
      voterRegistration: supporterData.voterRegistration,
      electoralZone: supporterData.electoralZone,
      electoralSection: supporterData.electoralSection,
      leaderId: supporterData.leaderId,
      notes: supporterData.notes ?? '',
      consentAccepted: supporterData.consentAccepted,
      consentSource: supporterData.consentSource,
      status: supporterData.status,
    })
  }, [form, supporterData, user?.leaderId, user?.role])

  const mutation = useMutation({
    mutationFn: async (values: SupporterFormValues) => {
      const payload = { ...values, leaderId: user?.role === 'LEADER' ? user.leaderId : values.leaderId }
      if (isEdit) {
        const r = await api.put<{ supporter: Supporter }>(`/supporters/${id}`, payload)
        return r.data.supporter
      }
      const r = await api.post<{ supporter: Supporter }>('/supporters', payload)
      return r.data.supporter
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
      navigate('/supporters')
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  if (user?.role === 'SUPERVISOR') {
    return (
      <div className="app-card p-8 text-center text-slate-500">
        Supervisores acompanham os apoiadores, mas não realizam o cadastro direto.
      </div>
    )
  }

  if (isLoading) {
    return <div className="app-card p-8 text-center text-slate-400">Carregando dados do apoiador...</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label">{isEdit ? 'Edição' : 'Novo cadastro'}</div>
          <h2 className="page-title mt-1">{isEdit ? 'Editar apoiador' : 'Cadastrar apoiador'}</h2>
        </div>
        <Link to="/supporters" className="button-secondary">
          Cancelar
        </Link>
      </div>

      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
        {/* Dados pessoais */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Dados pessoais</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo">
              <TextInput {...form.register('fullName', { required: true })} placeholder="Nome completo" />
            </Field>
            <Field label="CPF">
              <TextInput {...form.register('cpf', { required: true })} placeholder="000.000.000-00" />
            </Field>
            <Field label="Telefone">
              <TextInput {...form.register('phone')} placeholder="(11) 90000-0000" />
            </Field>
            <Field label="Data de nascimento">
              <TextInput type="date" {...form.register('birthDate', { required: true })} />
            </Field>
          </div>
        </div>

        {/* Endereço */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Endereço</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CEP">
              <TextInput {...form.register('postalCode', { required: true })} placeholder="00000-000" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Rua">
                <TextInput {...form.register('street', { required: true })} />
              </Field>
            </div>
            <Field label="Número">
              <TextInput {...form.register('number', { required: true })} />
            </Field>
            <Field label="Complemento">
              <TextInput {...form.register('complement')} placeholder="Apto, bloco..." />
            </Field>
            <Field label="Bairro">
              <TextInput {...form.register('neighborhood', { required: true })} />
            </Field>
            <Field label="Cidade">
              <TextInput {...form.register('city', { required: true })} />
            </Field>
            <Field label="Estado">
              <TextInput {...form.register('state', { required: true })} maxLength={2} placeholder="SP" />
            </Field>
          </div>
        </div>

        {/* Dados eleitorais */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Dados eleitorais</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título de eleitor">
              <TextInput {...form.register('voterRegistration', { required: true })} />
            </Field>
            <Field label="Zona eleitoral">
              <TextInput {...form.register('electoralZone', { required: true })} />
            </Field>
            <Field label="Seção eleitoral">
              <TextInput {...form.register('electoralSection', { required: true })} />
            </Field>
            <Field label="Líder responsável">
              {user?.role === 'ADMIN' ? (
                <SelectInput {...form.register('leaderId', { required: true })}>
                  <option value="">Selecione</option>
                  {(leaders ?? []).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </SelectInput>
              ) : (
                <TextInput value="Vinculado ao líder autenticado" disabled />
              )}
            </Field>
            <Field label="Status">
              <SelectInput {...form.register('status')}>
                <option value="ACTIVE">Ativo</option>
                <option value="ARCHIVED">Arquivado</option>
                <option value="ANONYMIZED">Anonimizado</option>
              </SelectInput>
            </Field>
          </div>
        </div>

        {/* Consentimento & Notas */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Consentimento LGPD</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Origem do consentimento">
              <SelectInput {...form.register('consentSource')}>
                {(['WEB_FORM', 'PRESENTIAL', 'EVENT', 'WHATSAPP', 'PHONE', 'OTHER'] as ConsentSource[]).map((opt) => (
                  <option key={opt} value={opt}>{statusLabel(opt)}</option>
                ))}
              </SelectInput>
            </Field>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <CheckboxInput {...form.register('consentAccepted')} />
              <span className="text-sm text-slate-700">Consentimento LGPD aceito pelo titular</span>
            </div>
            <div className="sm:col-span-2">
              <Field label="Observações">
                <TextAreaInput {...form.register('notes')} placeholder="Informações adicionais sobre o apoiador..." />
              </Field>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" className="button-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar apoiador'}
          </button>
          <Link to="/supporters" className="button-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
