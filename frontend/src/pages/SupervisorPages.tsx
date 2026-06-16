import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

  return (
    <div className="app-card p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Estrutura de coordenacao</div>
          <h2 className="font-display text-2xl font-bold">Lista de supervisores</h2>
        </div>
        {user?.role === 'ADMIN' ? (
          <Link to="/supervisors/new" className="button-primary">
            Novo supervisor
          </Link>
        ) : null}
      </div>

      {isLoading ? <div className="text-slate-600">Carregando supervisores...</div> : null}

      {(data ?? []).length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">Nome</th>
                <th className="pb-3">Lideres</th>
                <th className="pb-3">Pode criar lideres</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Atualizado</th>
                <th className="pb-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.map((supervisor) => (
                <tr key={supervisor.id}>
                  <td className="py-4">
                    <div className="font-semibold">{supervisor.name}</div>
                    <div className="text-slate-500">{supervisor.email}</div>
                  </td>
                  <td className="py-4">{supervisor.leadersCount}</td>
                  <td className="py-4">{supervisor.canCreateLeaders ? 'Sim' : 'Nao'}</td>
                  <td className="py-4">
                    <StatusPill value={supervisor.status} />
                  </td>
                  <td className="py-4 text-slate-500">{formatDateTime(supervisor.updatedAt)}</td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {user?.role === 'ADMIN' ? (
                        <>
                          <Link to={`/supervisors/${supervisor.id}/edit`} className="button-secondary">
                            Editar
                          </Link>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => {
                              if (window.confirm(`Excluir o supervisor ${supervisor.name}?`)) {
                                deleteMutation.mutate(supervisor.id)
                              }
                            }}
                          >
                            Excluir
                          </button>
                        </>
                      ) : (
                        <Link to={`/supervisors/${supervisor.id}/edit`} className="button-secondary">
                          Visualizar
                        </Link>
                      )}
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

  return (
    <div className="app-card p-6">
      <div className="mb-6">
        <div className="text-sm text-slate-500">{isEdit ? 'Perfil de supervisao' : 'Novo cadastro de supervisor'}</div>
        <h2 className="font-display text-2xl font-bold">{isEdit ? (isAdmin ? 'Editar supervisor' : 'Meu perfil de supervisao') : 'Cadastrar supervisor'}</h2>
      </div>

      {isLoading ? <div className="text-slate-600">Carregando dados do supervisor...</div> : null}

      <form className="grid gap-5 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field label="Nome completo">
          <TextInput {...form.register('name', { required: true })} disabled={!isAdmin} />
        </Field>
        <Field label="CPF">
          <TextInput {...form.register('cpf', { required: true })} disabled={!isAdmin} />
        </Field>
        <Field label="Telefone">
          <TextInput {...form.register('phone')} disabled={!isAdmin} />
        </Field>
        <Field label="E-mail">
          <TextInput type="email" {...form.register('email', { required: true })} disabled={!isAdmin} />
        </Field>
        <Field label="Endereco completo">
          <TextInput {...form.register('fullAddress', { required: true })} disabled={!isAdmin} />
        </Field>
        <Field label="Cidade">
          <TextInput {...form.register('city', { required: true })} disabled={!isAdmin} />
        </Field>
        <Field label="Bairro">
          <TextInput {...form.register('neighborhood', { required: true })} disabled={!isAdmin} />
        </Field>
        <Field label="Status">
          <SelectInput {...form.register('status')} disabled={!isAdmin}>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </SelectInput>
        </Field>
        <Field label="Permissao para criar lideres">
          <SelectInput {...form.register('canCreateLeaders')} disabled={!isAdmin}>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </SelectInput>
        </Field>
        <Field label={isEdit ? 'Nova senha (opcional)' : 'Senha inicial'}>
          <TextInput type="password" {...form.register('password', { required: !isEdit })} disabled={!isAdmin} />
        </Field>

        {isAdmin ? (
          <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
            <button type="submit" className="button-primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alteracoes' : 'Criar supervisor'}
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
