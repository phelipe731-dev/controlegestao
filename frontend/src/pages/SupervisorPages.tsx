import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, ShieldCheck } from 'lucide-react'
import { Field, SelectInput, TextInput } from '../components/FormControls'
import { StatusPill } from '../components/StatusPill'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { formatDateTime } from '../lib/format'
import type { Supervisor, UserStatus } from '../types/api'

type SupervisorFormValues = {
  name: string
  cpf: string
  phone: string
  email: string
  fullAddress: string
  city: string
  neighborhood: string
  status: UserStatus
  canCreateLeaders: 'true' | 'false'
  password: string
}

const initialValues: SupervisorFormValues = {
  name: '',
  cpf: '',
  phone: '',
  email: '',
  fullAddress: '',
  city: '',
  neighborhood: '',
  status: 'ACTIVE',
  canCreateLeaders: 'false',
  password: '',
}

export function SupervisorListPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['supervisors'],
    queryFn: async () => {
      const response = await api.get<{ supervisors: Supervisor[] }>('/supervisors')
      return response.data.supervisors
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (supervisorId: string) => {
      await api.delete(`/supervisors/${supervisorId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supervisors'] })
      alert('Supervisor removido com sucesso.')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  const supervisors = data ?? []

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="section-label">Estrutura de coordenação</div>
          <h2 className="page-title mt-1">Lista de supervisores</h2>
        </div>
        {user?.role === 'ADMIN' ? (
          <Link to="/supervisors/new" className="button-primary ml-auto">
            <Plus className="h-4 w-4" />
            Novo supervisor
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

        {!isLoading && supervisors.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-slate-300" />
            <div className="text-sm font-medium text-slate-500">Nenhum supervisor cadastrado</div>
            <div className="mt-1 text-xs text-slate-400">Cadastre um novo supervisor para começar.</div>
          </div>
        )}

        {supervisors.length > 0 && (
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Líderes</th>
                  <th>Pode criar líderes</th>
                  <th>Status</th>
                  <th>Atualizado</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {supervisors.map((supervisor) => (
                  <tr key={supervisor.id}>
                    <td>
                      <div className="font-medium text-ink">{supervisor.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{supervisor.email}</div>
                    </td>
                    <td>{supervisor.leadersCount}</td>
                    <td>{supervisor.canCreateLeaders ? 'Sim' : 'Não'}</td>
                    <td>
                      <StatusPill value={supervisor.status} />
                    </td>
                    <td className="text-xs text-slate-400">{formatDateTime(supervisor.updatedAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {user?.role === 'ADMIN' ? (
                          <>
                            <Link to={`/supervisors/${supervisor.id}/edit`} className="button-ghost px-2.5 py-1.5">
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </Link>
                            <button
                              type="button"
                              title="Excluir"
                              className="button-ghost px-2.5 py-1.5 text-rose hover:bg-rose/10 hover:text-rose"
                              onClick={() => {
                                if (window.confirm(`Excluir o supervisor ${supervisor.name}?`)) {
                                  deleteMutation.mutate(supervisor.id)
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Excluir</span>
                            </button>
                          </>
                        ) : (
                          <Link to={`/supervisors/${supervisor.id}/edit`} className="button-ghost px-2.5 py-1.5">
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Visualizar</span>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
              {supervisors.length} registro{supervisors.length !== 1 ? 's' : ''} encontrado{supervisors.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function SupervisorFormPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = Boolean(id)
  const isAdmin = user?.role === 'ADMIN'

  const form = useForm<SupervisorFormValues>({
    defaultValues: initialValues,
  })

  const { data: supervisorData, isLoading } = useQuery({
    queryKey: ['supervisor', id],
    queryFn: async () => {
      const response = await api.get<{ supervisor: Supervisor }>(`/supervisors/${id}`)
      return response.data.supervisor
    },
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (!supervisorData) {
      return
    }

    form.reset({
      name: supervisorData.name,
      cpf: supervisorData.cpf,
      phone: supervisorData.phone ?? '',
      email: supervisorData.email,
      fullAddress: supervisorData.fullAddress ?? '',
      city: supervisorData.city ?? '',
      neighborhood: supervisorData.neighborhood ?? '',
      status: supervisorData.status,
      canCreateLeaders: supervisorData.canCreateLeaders ? 'true' : 'false',
      password: '',
    })
  }, [form, supervisorData])

  const mutation = useMutation({
    mutationFn: async (values: SupervisorFormValues) => {
      const payload = {
        ...values,
        canCreateLeaders: values.canCreateLeaders === 'true',
        password: values.password || undefined,
      }

      if (isEdit) {
        const response = await api.put<{ supervisor: Supervisor }>(`/supervisors/${id}`, payload)
        return response.data.supervisor
      }

      const response = await api.post<{ supervisor: Supervisor }>('/supervisors', payload)
      return response.data.supervisor
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['supervisors'] })
      alert(`Supervisor ${isEdit ? 'atualizado' : 'criado'} com sucesso.`)
      navigate('/supervisors')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  if (!isAdmin && !isEdit) {
    return <div className="app-card p-6 text-slate-600">Somente administradores podem cadastrar supervisores.</div>
  }

  if (isLoading) {
    return <div className="app-card p-8 text-center text-slate-400">Carregando dados do supervisor...</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="section-label">{isEdit ? 'Perfil de supervisão' : 'Novo cadastro de supervisor'}</div>
          <h2 className="page-title mt-1">{isEdit ? (isAdmin ? 'Editar supervisor' : 'Meu perfil de supervisão') : 'Cadastrar supervisor'}</h2>
        </div>
        <Link to="/supervisors" className="button-secondary">
          {isAdmin ? 'Cancelar' : 'Voltar'}
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
              <TextInput {...form.register('name', { required: true })} disabled={!isAdmin} />
            </Field>
            <Field label="CPF">
              <TextInput {...form.register('cpf', { required: true })} disabled={!isAdmin} />
            </Field>
            <Field label="E-mail">
              <TextInput type="email" {...form.register('email', { required: true })} disabled={!isAdmin} />
            </Field>
            <Field label={isEdit ? 'Nova senha (opcional)' : 'Senha inicial'}>
              <TextInput type="password" {...form.register('password', { required: !isEdit })} disabled={!isAdmin} />
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
              <TextInput {...form.register('phone')} disabled={!isAdmin} />
            </Field>
            <Field label="Endereço completo">
              <TextInput {...form.register('fullAddress', { required: true })} disabled={!isAdmin} />
            </Field>
            <Field label="Cidade">
              <TextInput {...form.register('city', { required: true })} disabled={!isAdmin} />
            </Field>
            <Field label="Bairro">
              <TextInput {...form.register('neighborhood', { required: true })} disabled={!isAdmin} />
            </Field>
          </div>
        </div>

        {/* Vínculo */}
        <div className="app-card p-5">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-ink">Vínculo</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <SelectInput {...form.register('status')} disabled={!isAdmin}>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </SelectInput>
            </Field>
            <Field label="Permissão para criar líderes">
              <SelectInput {...form.register('canCreateLeaders')} disabled={!isAdmin}>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </SelectInput>
            </Field>
          </div>
        </div>

        {isAdmin ? (
          <div className="flex gap-3">
            <button type="submit" className="button-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar supervisor'}
            </button>
            <Link to="/supervisors" className="button-secondary">
              Cancelar
            </Link>
          </div>
        ) : null}
      </form>
    </div>
  )
}
