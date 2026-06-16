import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
    <div className="app-card p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Controle de liderancas</div>
          <h2 className="font-display text-2xl font-bold">Lista de lideres</h2>
        </div>
        {canManage ? (
          <Link to="/leaders/new" className="button-primary">
            Novo lider
          </Link>
        ) : null}
      </div>

      {isLoading ? <div className="text-slate-600">Carregando lideres...</div> : null}

      {!isLoading && leaders.length === 0 ? <div className="text-slate-500">Nenhum lider cadastrado.</div> : null}

      {leaders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">Nome</th>
                <th className="pb-3">Supervisor</th>
                <th className="pb-3">Apoiadores</th>
                <th className="pb-3">Cadastros</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Atualizado</th>
                <th className="pb-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaders.map((leader) => (
                <tr key={leader.id}>
                  <td className="py-4">
                    <div className="font-semibold text-ink">{leader.name}</div>
                    <div className="text-slate-500">{leader.email}</div>
                  </td>
                  <td className="py-4">{leader.supervisorName ?? '-'}</td>
                  <td className="py-4">{leader.supportersCount}</td>
                  <td className="py-4">{leader.createdRegistrations}</td>
                  <td className="py-4">
                    <StatusPill value={leader.status} />
                  </td>
                  <td className="py-4 text-slate-500">{formatDateTime(leader.updatedAt)}</td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/leaders/${leader.id}/edit`} className="button-secondary">
                        Editar
                      </Link>
                      {canManage ? (
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => {
                            if (window.confirm(`Excluir o lider ${leader.name}?`)) {
                              deleteMutation.mutate(leader.id)
                            }
                          }}
                        >
                          Excluir
                        </button>
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

  return (
    <div className="app-card p-6">
      <div className="mb-6">
        <div className="text-sm text-slate-500">{isEdit ? 'Atualizacao de acesso e vinculacao' : 'Novo cadastro de lider'}</div>
        <h2 className="font-display text-2xl font-bold">{isEdit ? 'Editar lider' : 'Cadastrar lider'}</h2>
      </div>

      {isLoading ? <div className="text-slate-600">Carregando dados do lider...</div> : null}

      <form className="grid gap-5 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field label="Nome completo">
          <TextInput {...form.register('name', { required: true })} />
        </Field>
        <Field label="CPF">
          <TextInput {...form.register('cpf', { required: true })} />
        </Field>
        <Field label="Telefone">
          <TextInput {...form.register('phone')} />
        </Field>
        <Field label="E-mail">
          <TextInput type="email" {...form.register('email', { required: true })} />
        </Field>
        <Field label="Endereco completo">
          <TextInput {...form.register('fullAddress', { required: true })} />
        </Field>
        <Field label="Cidade">
          <TextInput {...form.register('city', { required: true })} />
        </Field>
        <Field label="Bairro">
          <TextInput {...form.register('neighborhood', { required: true })} />
        </Field>
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
        <Field label={isEdit ? 'Nova senha (opcional)' : 'Senha inicial'}>
          <TextInput type="password" {...form.register('password', { required: !isEdit })} />
        </Field>

        <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
          <button type="submit" className="button-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alteracoes' : 'Criar lider'}
          </button>
          <Link to="/leaders" className="button-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
