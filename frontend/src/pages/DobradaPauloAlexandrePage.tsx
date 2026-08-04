import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Pencil, Search, SlidersHorizontal, Trash2, UsersRound, X } from 'lucide-react'
import { Field, SelectInput, TextAreaInput, TextInput } from '../components/FormControls'
import { StatusPill } from '../components/StatusPill'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { cpfMask, formatDateTime } from '../lib/format'
import type { DobradaPauloAlexandreLeader, UserStatus } from '../types/api'

type DobradaLeaderFormValues = {
  fullName: string
  cpf: string
  phone: string
  email: string
  fullAddress: string
  city: string
  neighborhood: string
  source: string
  notes: string
  status: UserStatus
}

type DobradaLeaderFilters = {
  search: string
  city: string
  neighborhood: string
  status: string
}

const initialFormValues: DobradaLeaderFormValues = {
  fullName: '',
  cpf: '',
  phone: '',
  email: '',
  fullAddress: '',
  city: '',
  neighborhood: '',
  source: '',
  notes: '',
  status: 'ACTIVE',
}

const initialFilters: DobradaLeaderFilters = {
  search: '',
  city: '',
  neighborhood: '',
  status: '',
}

function nullable(value?: string | null) {
  return value ?? ''
}

function toPayload(values: DobradaLeaderFormValues) {
  return {
    ...values,
    cpf: values.cpf || null,
    phone: values.phone || null,
    email: values.email || null,
    fullAddress: values.fullAddress || null,
    city: values.city || null,
    neighborhood: values.neighborhood || null,
    source: values.source || null,
    notes: values.notes || null,
  }
}

function toFormValues(leader: DobradaPauloAlexandreLeader): DobradaLeaderFormValues {
  return {
    fullName: leader.fullName,
    cpf: nullable(leader.cpf),
    phone: nullable(leader.phone),
    email: nullable(leader.email),
    fullAddress: nullable(leader.fullAddress),
    city: nullable(leader.city),
    neighborhood: nullable(leader.neighborhood),
    source: nullable(leader.source),
    notes: nullable(leader.notes),
    status: leader.status,
  }
}

export function DobradaPauloAlexandrePage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [editingLeader, setEditingLeader] = useState<DobradaPauloAlexandreLeader | null>(null)
  const [filters, setFilters] = useState<DobradaLeaderFilters>(initialFilters)
  const pageSize = 25

  const createForm = useForm<DobradaLeaderFormValues>({
    defaultValues: initialFormValues,
  })

  const editForm = useForm<DobradaLeaderFormValues>({
    defaultValues: initialFormValues,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['dobrada-paulo-alexandre-leaders', filters, page],
    queryFn: async () => {
      const filledFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value.trim() !== ''),
      )
      const response = await api.get<{
        leaders: DobradaPauloAlexandreLeader[]
        total: number
        page: number
        limit: number
        totalPages: number
      }>('/dobrada-paulo-alexandre/leaders', { params: { ...filledFilters, page, limit: pageSize } })
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: DobradaLeaderFormValues) => {
      const response = await api.post<{ leader: DobradaPauloAlexandreLeader }>(
        '/dobrada-paulo-alexandre/leaders',
        toPayload(values),
      )
      return response.data.leader
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dobrada-paulo-alexandre-leaders'] })
      createForm.reset(initialFormValues)
      alert('Liderança cadastrada na dobrada.')
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const updateMutation = useMutation({
    mutationFn: async (values: DobradaLeaderFormValues) => {
      if (!editingLeader) {
        throw new Error('Nenhuma liderança selecionada para edição.')
      }

      const response = await api.put<{ leader: DobradaPauloAlexandreLeader }>(
        `/dobrada-paulo-alexandre/leaders/${editingLeader.id}`,
        toPayload(values),
      )
      return response.data.leader
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dobrada-paulo-alexandre-leaders'] })
      editForm.reset(initialFormValues)
      setEditingLeader(null)
      alert('Liderança atualizada com sucesso.')
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (leaderId: string) => {
      await api.delete(`/dobrada-paulo-alexandre/leaders/${leaderId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dobrada-paulo-alexandre-leaders'] })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const leaders = data?.leaders ?? []
  const totalLeaders = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const activeFilters = Object.values(filters).filter(Boolean).length

  const updateFilters = (updater: (current: DobradaLeaderFilters) => DobradaLeaderFilters) => {
    setPage(1)
    setFilters(updater)
  }

  const startEdit = (leader: DobradaPauloAlexandreLeader) => {
    setEditingLeader(leader)
    editForm.reset(toFormValues(leader))
  }

  const cancelEdit = () => {
    setEditingLeader(null)
    editForm.reset(initialFormValues)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-teal/20 bg-gradient-to-br from-ink to-sidebar p-5 text-white shadow-card-md sm:p-6">
        <div className="section-label text-teal/80">Base paralela de lideranças</div>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">DOBRADA PAULO ALEXANDRE</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/65">
              Cadastre lideranças desta dobrada sem bloquear duplicidades. Estes registros não criam login e não interferem na base oficial de líderes.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-white/50">Total cadastrado</div>
            <div className="mt-1 font-display text-3xl font-bold">{totalLeaders}</div>
          </div>
        </div>
      </div>

      <form className="app-card p-5 sm:p-6" onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="section-label">Novo cadastro</div>
            <h3 className="mt-1 font-display text-lg font-bold text-ink">Adicionar liderança da dobrada</h3>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Nome da liderança">
            <TextInput {...createForm.register('fullName', { required: true })} placeholder="Nome completo ou apelido operacional" />
          </Field>
          <Field label="Telefone">
            <TextInput {...createForm.register('phone')} placeholder="WhatsApp ou telefone" />
          </Field>
          <Field label="CPF (opcional e pode repetir)">
            <TextInput {...createForm.register('cpf')} />
          </Field>
          <Field label="E-mail">
            <TextInput type="email" {...createForm.register('email')} />
          </Field>
          <Field label="Cidade">
            <TextInput {...createForm.register('city')} />
          </Field>
          <Field label="Bairro/região">
            <TextInput {...createForm.register('neighborhood')} />
          </Field>
          <Field label="Endereço">
            <TextInput {...createForm.register('fullAddress')} />
          </Field>
          <Field label="Origem">
            <TextInput {...createForm.register('source')} placeholder="Ex: reunião, indicação, bairro" />
          </Field>
          <Field label="Status">
            <SelectInput {...createForm.register('status')}>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </SelectInput>
          </Field>
          <div className="md:col-span-2 xl:col-span-3">
            <Field label="Observações">
              <TextAreaInput {...createForm.register('notes')} placeholder="Anotações internas sobre a liderança da dobrada" />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" className="button-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Salvando...' : 'Cadastrar na dobrada'}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field-base pl-9"
            placeholder="Buscar por nome, telefone, CPF, cidade, bairro ou origem..."
            value={filters.search}
            onChange={(event) => updateFilters((current) => ({ ...current, search: event.target.value }))}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((current) => !current)}
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
      </div>

      {showFilters && (
        <div className="app-card p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Cidade">
              <TextInput value={filters.city} onChange={(event) => updateFilters((current) => ({ ...current, city: event.target.value }))} />
            </Field>
            <Field label="Bairro/região">
              <TextInput value={filters.neighborhood} onChange={(event) => updateFilters((current) => ({ ...current, neighborhood: event.target.value }))} />
            </Field>
            <Field label="Status">
              <SelectInput value={filters.status} onChange={(event) => updateFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="">Todos</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="button-ghost text-xs" onClick={() => updateFilters(() => initialFilters)}>
              Limpar filtros
            </button>
          </div>
        </div>
      )}

      <div className="app-card overflow-hidden">
        {isLoading && (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!isLoading && leaders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UsersRound className="mb-3 h-10 w-10 text-slate-300" />
            <div className="text-sm font-medium text-slate-500">
              {activeFilters > 0 ? 'Nenhuma liderança encontrada' : 'Nenhuma liderança cadastrada na dobrada'}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {activeFilters > 0 ? 'Tente ajustar os filtros.' : 'Cadastre a primeira liderança para começar.'}
            </div>
          </div>
        )}

        {leaders.length > 0 && (
          <>
            <div className="grid gap-3 p-4 xl:hidden">
              {leaders.map((leader) => (
                <div key={leader.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink">{leader.fullName}</div>
                      <div className="mt-1 text-sm text-slate-500">{leader.phone ?? 'Telefone não informado'}</div>
                    </div>
                    <StatusPill value={leader.status} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                    <div>Cidade: {leader.city ?? '-'}</div>
                    <div>Bairro: {leader.neighborhood ?? '-'}</div>
                    <div>CPF: {cpfMask(leader.cpf)}</div>
                    <div>Origem: {leader.source ?? '-'}</div>
                  </div>
                  {leader.notes && <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-600">{leader.notes}</div>}
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => startEdit(leader)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="button-ghost px-3 py-1.5 text-xs text-rose hover:bg-rose/10 hover:text-rose"
                      onClick={() => {
                        if (window.confirm(`Excluir ${leader.fullName} da dobrada?`)) {
                          deleteMutation.mutate(leader.id)
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Liderança</th>
                    <th>Contato</th>
                    <th>Localidade</th>
                    <th>Origem</th>
                    <th>Status</th>
                    <th>Atualizado</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((leader) => (
                    <tr key={leader.id}>
                      <td>
                        <div className="font-medium text-ink">{leader.fullName}</div>
                        <div className="mt-0.5 text-xs text-slate-400">CPF: {cpfMask(leader.cpf)}</div>
                      </td>
                      <td>
                        <div>{leader.phone ?? '-'}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{leader.email ?? '-'}</div>
                      </td>
                      <td>
                        <div>{leader.city ?? '-'}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{leader.neighborhood ?? '-'}</div>
                      </td>
                      <td>{leader.source ?? '-'}</td>
                      <td>
                        <StatusPill value={leader.status} />
                      </td>
                      <td className="text-xs text-slate-400">{formatDateTime(leader.updatedAt)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" className="button-ghost px-2.5 py-1.5" onClick={() => startEdit(leader)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button-ghost px-2.5 py-1.5 text-rose hover:bg-rose/10 hover:text-rose"
                            onClick={() => {
                              if (window.confirm(`Excluir ${leader.fullName} da dobrada?`)) {
                                deleteMutation.mutate(leader.id)
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              <span>
                {totalLeaders} registro{totalLeaders !== 1 ? 's' : ''} na dobrada
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="button-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                  Anterior
                </button>
                <span>
                  Página {page} de {totalPages}
                </span>
                <button type="button" className="button-secondary px-3 py-1.5 text-xs" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {editingLeader && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
          <form
            className="app-card max-h-[88vh] w-full max-w-4xl overflow-hidden"
            onSubmit={editForm.handleSubmit((values) => updateMutation.mutate(values))}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <div className="section-label">Editar liderança da dobrada</div>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">{editingLeader.fullName}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Atualize os dados do cadastro selecionado sem sair da lista.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink"
                onClick={cancelEdit}
                aria-label="Fechar edição"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Nome da liderança">
                  <TextInput {...editForm.register('fullName', { required: true })} />
                </Field>
                <Field label="Telefone">
                  <TextInput {...editForm.register('phone')} placeholder="WhatsApp ou telefone" />
                </Field>
                <Field label="CPF (opcional e pode repetir)">
                  <TextInput {...editForm.register('cpf')} />
                </Field>
                <Field label="E-mail">
                  <TextInput type="email" {...editForm.register('email')} />
                </Field>
                <Field label="Cidade">
                  <TextInput {...editForm.register('city')} />
                </Field>
                <Field label="Bairro/região">
                  <TextInput {...editForm.register('neighborhood')} />
                </Field>
                <Field label="Endereço">
                  <TextInput {...editForm.register('fullAddress')} />
                </Field>
                <Field label="Origem">
                  <TextInput {...editForm.register('source')} />
                </Field>
                <Field label="Status">
                  <SelectInput {...editForm.register('status')}>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </SelectInput>
                </Field>
                <div className="md:col-span-2 xl:col-span-3">
                  <Field label="Observações">
                    <TextAreaInput {...editForm.register('notes')} placeholder="Anotações internas sobre a liderança da dobrada" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 p-5">
              <button type="button" className="button-secondary" onClick={cancelEdit}>
                Cancelar
              </button>
              <button type="submit" className="button-primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
