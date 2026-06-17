import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { Field, SelectInput, TextInput } from '../components/FormControls'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import type { Leader, Supervisor, UserStatus } from '../types/api'

type LeaderFormValues = {
  name: string
  cpf: string
  phone: string
  email: string
  fullAddress: string
  city: string
  neighborhood: string
  supervisorId: string
  status: UserStatus
  password: string
}

const initialValues: LeaderFormValues = {
  name: '',
  cpf: '',
  phone: '',
  email: '',
  fullAddress: '',
  city: '',
  neighborhood: '',
  supervisorId: '',
  status: 'ACTIVE',
  password: '',
}

export function LeaderListPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canManage = user?.role === 'ADMIN' || (user?.role === 'SUPERVISOR' && user.canCreateLeaders)

  const { data, isLoading } = useQuery({
    queryKey: ['leaders'],
    queryFn: async () => {
      const response = await api.get<{ leaders: Leader[] }>('/leaders')
      return response.data.leaders
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (leaderId: string) => {
      await api.delete(`/leaders/${leaderId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leaders'] })
      alert('Lider removido com sucesso.')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  const leaders = data ?? []

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="section-label">Controle de lideranças</div>
          <h2 className="page-title mt-1">Lista de líderes</h2>
        </div>
        {canManage ? (
          <Link to="/leaders/new" className="button-primary ml-auto">
            <Plus className="h-4 w-4" />
            Novo líder
          </Link>
        ) : null}
      </div>

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

        {!isLoading && leaders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-slate-300" />
            <div className="text-sm font-medium text-slate-500">Nenhum líder cadastrado</div>
            <div className="mt-1 text-xs text-slate-400">Cadastre um novo líder para começar.</div>
          </div>
        )}

        {leaders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Supervisor</th>
                  <th>Apoiadores</th>
                  <th>Cadastros</th>
                  <th>Status</th>
                  <th>Atualizado</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((leader) => (
                  <tr key={leader.id}>
                    <td>
                      <div className="font-medium text-ink">{leader.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{leader.email}</div>
                    </td>
                    <td>{leader.supervisorName ?? '—'}</td>
                    <td>{leader.supportersCount}</td>
                    <td>{leader.createdRegistrations}</td>
                    <td>
                      <StatusPill value={leader.status} />
                    </td>
                    <td className="text-xs text-slate-400">{formatDateTime(leader.updatedAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link to={`/leaders/${leader.id}/edit`} className="button-ghost px-2.5 py-1.5">
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                        </Link>
                        {canManage ? (
                          <button
                            type="button"
                            title="Excluir"
                            className="button-ghost px-2.5 py-1.5 text-rose hover:bg-rose/10 hover:text-rose"
                            onClick={() => {
                              if (window.confirm(`Excluir o lider ${leader.name}?`)) {
                                deleteMutation.mutate(leader.id)
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
              {leaders.length} registro{leaders.length !== 1 ? 's' : ''} encontrado{leaders.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function LeaderFormPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)
  const canManage = user?.role === 'ADMIN' || (user?.role === 'SUPERVISOR' && user.canCreateLeaders)

  const form = useForm<LeaderFormValues>({
    defaultValues: initialValues,
  })

  const { data: supervisors } = useQuery({
    queryKey: ['supervisors-options'],
    queryFn: async () => {
      const response = await api.get<{ supervisors: Supervisor[] }>('/supervisors')
      return response.data.supervisors
    },
    enabled: user?.role === 'ADMIN',
  })

  const { data: leaderData, isLoading } = useQuery({
    queryKey: ['leader', id],
    queryFn: async () => {
      const response = await api.get<{ leader: Leader }>(`/leaders/${id}`)
      return response.data.leader
    },
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (!leaderData) {
      return
    }

    form.reset({
      name: leaderData.name,
      cpf: leaderData.cpf,
      phone: leaderData.phone ?? '',
      email: leaderData.email,
      fullAddress: leaderData.fullAddress ?? '',
      city: leaderData.city ?? '',
      neighborhood: leaderData.neighborhood ?? '',
      supervisorId: leaderData.supervisorId ?? '',
      status: leaderData.status,
      password: '',
    })
  }, [form, leaderData])

  const mutation = useMutation({
    mutationFn: async (values: LeaderFormValues) => {
      const payload = {
        ...values,
        supervisorId: user?.role === 'SUPERVISOR' ? user.supervisorId : values.supervisorId || null,
        password: values.password || undefined,
      }

      if (isEdit) {
        const response = await api.put<{ leader: Leader }>(`/leaders/${id}`, payload)
        return response.data.leader
      }

      const response = await api.post<{ leader: Leader }>('/leaders', payload)
      return response.data.leader
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leaders'] })
      alert(`Lider ${isEdit ? 'atualizado' : 'criado'} com sucesso.`)
      navigate('/leaders')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  if (!canManage) {
    return <div className="app-card p-6 text-slate-600">Seu perfil nao possui permissao para cadastrar ou editar lideres.</div>
  }

  if (isLoading) {
    return <div className="app-card p-8 text-center text-slate-400">Carregando dados do líder...</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label">{isEdit ? 'Atualização de acesso e vinculação' : 'Novo cadastro de líder'}</div>
          <h2 className="page-title mt-1">{isEdit ? 'Editar líder' : 'Cadastrar líder'}</h2>
        </div>
        <Link to="/leaders" className="button-secondary">
          Cancelar
        </Link>
      </div>

      <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        {/* Dados de acesso */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Dados de acesso</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo">
              <TextInput {...form.register('name', { required: true })} />
            </Field>
            <Field label="CPF">
              <TextInput {...form.register('cpf', { required: true })} />
            </Field>
            <Field label="E-mail">
              <TextInput type="email" {...form.register('email', { required: true })} />
            </Field>
            <Field label={isEdit ? 'Nova senha (opcional)' : 'Senha inicial'}>
              <TextInput type="password" {...form.register('password', { required: !isEdit })} />
            </Field>
          </div>
        </div>

        {/* Contato e endereço */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Contato e endereço</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone">
              <TextInput {...form.register('phone')} />
            </Field>
            <Field label="Endereço completo">
              <TextInput {...form.register('fullAddress', { required: true })} />
            </Field>
            <Field label="Cidade">
              <TextInput {...form.register('city', { required: true })} />
            </Field>
            <Field label="Bairro">
              <TextInput {...form.register('neighborhood', { required: true })} />
            </Field>
          </div>
        </div>

        {/* Vínculo */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Vínculo</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supervisor vinculado">
              {user?.role === 'ADMIN' ? (
                <SelectInput {...form.register('supervisorId')}>
                  <option value="">Sem supervisor</option>
                  {(supervisors ?? []).map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name}
                    </option>
                  ))}
                </SelectInput>
              ) : (
                <TextInput value="Supervisor autenticado" disabled />
              )}
            </Field>
            <Field label="Status">
              <SelectInput {...form.register('status')}>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </SelectInput>
            </Field>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="submit" className="button-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar líder'}
          </button>
          <Link to="/leaders" className="button-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
