import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Field, TextInput } from '../components/FormControls'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import type { CurrentUser } from '../types/api'

type ProfileForm = {
  name: string
  email: string
  cpf: string
  phone: string
  fullAddress: string
  city: string
  neighborhood: string
}

type PasswordForm = {
  currentPassword: string
  newPassword: string
}

export function AccountPage() {
  const { user, setUser } = useAuth()
  const profileForm = useForm<ProfileForm>({
    defaultValues: {
      name: '',
      email: '',
      cpf: '',
      phone: '',
      fullAddress: '',
      city: '',
      neighborhood: '',
    },
  })
  const passwordForm = useForm<PasswordForm>()

  useEffect(() => {
    if (!user) {
      return
    }

    profileForm.reset({
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      phone: user.phone ?? '',
      fullAddress: user.fullAddress ?? '',
      city: user.city ?? '',
      neighborhood: user.neighborhood ?? '',
    })
  }, [profileForm, user])

  const profileMutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const response = await api.put<{ user: CurrentUser }>('/account/me', values)
      return response.data.user
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser)
      alert('Perfil atualizado com sucesso.')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  const passwordMutation = useMutation({
    mutationFn: async (values: PasswordForm) => {
      await api.put('/account/password', values)
    },
    onSuccess: () => {
      passwordForm.reset()
      alert('Senha atualizada com sucesso.')
    },
    onError: (error) => {
      alert(getErrorMessage(error))
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="app-card p-6">
        <div className="text-sm text-slate-500">Dados pessoais</div>
        <h2 className="mt-2 font-display text-2xl font-bold">Minha conta</h2>

        <form className="mt-6 grid gap-5 md:grid-cols-2" onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))}>
          <Field label="Nome completo">
            <TextInput {...profileForm.register('name', { required: true })} />
          </Field>
          <Field label="E-mail">
            <TextInput type="email" {...profileForm.register('email', { required: true })} />
          </Field>
          <Field label="CPF">
            <TextInput {...profileForm.register('cpf', { required: true })} />
          </Field>
          <Field label="Telefone">
            <TextInput {...profileForm.register('phone')} />
          </Field>
          <Field label="Endereco completo">
            <TextInput {...profileForm.register('fullAddress')} />
          </Field>
          <Field label="Cidade">
            <TextInput {...profileForm.register('city')} />
          </Field>
          <Field label="Bairro">
            <TextInput {...profileForm.register('neighborhood')} />
          </Field>
          <div className="md:col-span-2 pt-2">
            <button type="submit" className="button-primary" disabled={profileMutation.isPending}>
              {profileMutation.isPending ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </form>
      </section>

      <section className="app-card p-6">
        <div className="text-sm text-slate-500">Seguranca</div>
        <h2 className="mt-2 font-display text-2xl font-bold">Trocar senha</h2>

        <form className="mt-6 space-y-5" onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}>
          <Field label="Senha atual">
            <TextInput type="password" {...passwordForm.register('currentPassword', { required: true })} />
          </Field>
          <Field label="Nova senha">
            <TextInput type="password" {...passwordForm.register('newPassword', { required: true })} />
          </Field>
          <button type="submit" className="button-primary" disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>
      </section>
    </div>
  )
}
