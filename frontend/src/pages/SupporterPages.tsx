import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  const [filters, setFilters] = useState<SupporterFilters>({
    search: '',
    leaderId: '',
    city: '',
    neighborhood: '',
    electoralZone: '',
    status: '',
  })
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({})

  const { data: leaders } = useQuery({
    queryKey: ['leaders-options'],
    queryFn: async () => {
      const response = await api.get<{ leaders: Leader[] }>('/leaders')
      return response.data.leaders
    },
    enabled: user?.role !== 'LEADER',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['supporters', filters],
    queryFn: async () => {
      const response = await api.get<{ supporters: Supporter[] }>('/supporters', { params: filters })
      return response.data.supporters
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/supporters/${id}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
      alert('Apoiador removido com sucesso.')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  const transferMutation = useMutation({
    mutationFn: async ({ supporterId, leaderId }: { supporterId: string; leaderId: string }) => {
      await api.post(`/supporters/${supporterId}/transfer`, { leaderId })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
      alert('Apoiador transferido com sucesso.')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  const anonymizeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/supporters/${id}/anonymize`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
      alert('Cadastro anonimizado com sucesso.')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  const supporters = data ?? []
  const canWrite = user?.role === 'ADMIN' || user?.role === 'LEADER'

  return (
    <div className="space-y-6">
      <div className="app-card p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Base territorial</div>
            <h2 className="font-display text-2xl font-bold">Lista de apoiadores</h2>
          </div>
          {canWrite ? (
            <Link to="/supporters/new" className="button-primary">
              Novo apoiador
            </Link>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Field label="Busca">
            <TextInput value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nome, CPF ou titulo" />
          </Field>
          {user?.role !== 'LEADER' ? (
            <Field label="Lider">
              <SelectInput value={filters.leaderId} onChange={(event) => setFilters((current) => ({ ...current, leaderId: event.target.value }))}>
                <option value="">Todos</option>
                {(leaders ?? []).map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}
          <Field label="Cidade">
            <TextInput value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} />
          </Field>
          <Field label="Bairro">
            <TextInput value={filters.neighborhood} onChange={(event) => setFilters((current) => ({ ...current, neighborhood: event.target.value }))} />
          </Field>
          <Field label="Zona eleitoral">
            <TextInput value={filters.electoralZone} onChange={(event) => setFilters((current) => ({ ...current, electoralZone: event.target.value }))} />
          </Field>
          <Field label="Status">
            <SelectInput value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">Todos</option>
              <option value="ACTIVE">Ativo</option>
              <option value="ARCHIVED">Arquivado</option>
              <option value="ANONYMIZED">Anonimizado</option>
            </SelectInput>
          </Field>
        </div>
      </div>

      <div className="app-card p-6">
        {isLoading ? <div className="text-slate-600">Carregando apoiadores...</div> : null}

        {!isLoading && supporters.length === 0 ? <div className="text-slate-500">Nenhum apoiador encontrado para os filtros aplicados.</div> : null}

        {supporters.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="pb-3">Apoiador</th>
                  <th className="pb-3">Cidade / Bairro</th>
                  <th className="pb-3">Zona / Secao</th>
                  <th className="pb-3">Lider</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Cadastro</th>
                  <th className="pb-3 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supporters.map((supporter) => (
                  <tr key={supporter.id}>
                    <td className="py-4">
                      <div className="font-semibold">{supporter.fullName}</div>
                      <div className="text-slate-500">
                        {cpfMask(supporter.cpf)} • {supporter.phone || 'Sem telefone'}
                      </div>
                    </td>
                    <td className="py-4">
                      <div>{supporter.city}</div>
                      <div className="text-slate-500">{supporter.neighborhood}</div>
                    </td>
                    <td className="py-4">
                      <div>Zona {supporter.electoralZone}</div>
                      <div className="text-slate-500">Secao {supporter.electoralSection}</div>
                    </td>
                    <td className="py-4">
                      <div>{supporter.leaderName}</div>
                      <div className="text-slate-500">{supporter.supervisorName ?? '-'}</div>
                    </td>
                    <td className="py-4">
                      <StatusPill value={supporter.status} />
                    </td>
                    <td className="py-4 text-slate-500">{formatDateTime(supporter.createdAt)}</td>
                    <td className="py-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        {user?.role !== 'SUPERVISOR' ? (
                          <Link to={`/supporters/${supporter.id}/edit`} className="button-secondary">
                            Editar
                          </Link>
                        ) : null}

                        {user?.role === 'ADMIN' ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <SelectInput
                              className="min-w-[180px]"
                              value={transferTarget[supporter.id] ?? ''}
                              onChange={(event) =>
                                setTransferTarget((current) => ({
                                  ...current,
                                  [supporter.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Transferir para...</option>
                              {(leaders ?? []).map((leader) => (
                                <option key={leader.id} value={leader.id}>
                                  {leader.name}
                                </option>
                              ))}
                            </SelectInput>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => {
                                const leaderId = transferTarget[supporter.id]
                                if (!leaderId) {
                                  alert('Selecione o novo lider antes de transferir.')
                                  return
                                }
                                transferMutation.mutate({ supporterId: supporter.id, leaderId })
                              }}
                            >
                              Transferir
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => {
                                if (window.confirm(`Anonimizar o cadastro de ${supporter.fullName}?`)) {
                                  anonymizeMutation.mutate(supporter.id)
                                }
                              }}
                            >
                              Anonimizar
                            </button>
                            <button
                              type="button"
                              className="button-danger"
                              onClick={() => {
                                if (window.confirm(`Excluir o cadastro de ${supporter.fullName}?`)) {
                                  deleteMutation.mutate(supporter.id)
                                }
                              }}
                            >
                              Excluir
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
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

  const form = useForm<SupporterFormValues>({
    defaultValues: initialForm,
  })

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
      if (user?.role === 'LEADER' && user.leaderId) {
        form.setValue('leaderId', user.leaderId)
      }
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
      const payload = {
        ...values,
        leaderId: user?.role === 'LEADER' ? user.leaderId : values.leaderId,
      }

      if (isEdit) {
        const response = await api.put<{ supporter: Supporter }>(`/supporters/${id}`, payload)
        return response.data.supporter
      }

      const response = await api.post<{ supporter: Supporter }>('/supporters', payload)
      return response.data.supporter
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supporters'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
      alert(`Apoiador ${isEdit ? 'atualizado' : 'cadastrado'} com sucesso.`)
      navigate('/supporters')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  if (user?.role === 'SUPERVISOR') {
    return <div className="app-card p-6 text-slate-600">Supervisores acompanham os apoiadores, mas nao realizam o cadastro direto neste MVP.</div>
  }

  return (
    <div className="app-card p-6">
      <div className="mb-6">
        <div className="text-sm text-slate-500">{isEdit ? 'Atualizacao e consentimento' : 'Novo cadastro de campanha'}</div>
        <h2 className="font-display text-2xl font-bold">{isEdit ? 'Editar apoiador' : 'Cadastrar apoiador'}</h2>
      </div>

      {isLoading ? <div className="text-slate-600">Carregando dados do apoiador...</div> : null}

      <form className="grid gap-5 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field label="Nome completo">
          <TextInput {...form.register('fullName', { required: true })} />
        </Field>
        <Field label="CPF">
          <TextInput {...form.register('cpf', { required: true })} />
        </Field>
        <Field label="Telefone">
          <TextInput {...form.register('phone')} />
        </Field>
        <Field label="Data de nascimento">
          <TextInput type="date" {...form.register('birthDate', { required: true })} />
        </Field>
        <Field label="CEP">
          <TextInput {...form.register('postalCode', { required: true })} />
        </Field>
        <Field label="Rua">
          <TextInput {...form.register('street', { required: true })} />
        </Field>
        <Field label="Numero">
          <TextInput {...form.register('number', { required: true })} />
        </Field>
        <Field label="Complemento">
          <TextInput {...form.register('complement')} />
        </Field>
        <Field label="Bairro">
          <TextInput {...form.register('neighborhood', { required: true })} />
        </Field>
        <Field label="Cidade">
          <TextInput {...form.register('city', { required: true })} />
        </Field>
        <Field label="Estado">
          <TextInput {...form.register('state', { required: true })} maxLength={2} />
        </Field>
        <Field label="Titulo de eleitor">
          <TextInput {...form.register('voterRegistration', { required: true })} />
        </Field>
        <Field label="Zona eleitoral">
          <TextInput {...form.register('electoralZone', { required: true })} />
        </Field>
        <Field label="Secao eleitoral">
          <TextInput {...form.register('electoralSection', { required: true })} />
        </Field>
        <Field label="Lider responsavel">
          {user?.role === 'ADMIN' ? (
            <SelectInput {...form.register('leaderId', { required: true })}>
              <option value="">Selecione</option>
              {(leaders ?? []).map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.name}
                </option>
              ))}
            </SelectInput>
          ) : (
            <TextInput value="Cadastro vinculado ao lider autenticado" disabled />
          )}
        </Field>
        <Field label="Status">
          <SelectInput {...form.register('status')}>
            <option value="ACTIVE">Ativo</option>
            <option value="ARCHIVED">Arquivado</option>
            <option value="ANONYMIZED">Anonimizado</option>
          </SelectInput>
        </Field>
        <div className="md:col-span-2">
          <Field label="Observacoes">
            <TextAreaInput {...form.register('notes')} />
          </Field>
        </div>
        <Field label="Origem do consentimento">
          <SelectInput {...form.register('consentSource')}>
            {(['WEB_FORM', 'PRESENTIAL', 'EVENT', 'WHATSAPP', 'PHONE', 'OTHER'] as ConsentSource[]).map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <CheckboxInput {...form.register('consentAccepted')} />
          <span className="text-sm font-medium text-slate-700">Consentimento LGPD aceito pelo titular</span>
        </label>

        <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <button type="submit" className="button-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alteracoes' : 'Cadastrar apoiador'}
          </button>
          <Link to="/supporters" className="button-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
