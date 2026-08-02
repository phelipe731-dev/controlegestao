import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { Field, TextInput } from '../components/FormControls'

function AccessBrand() {
  return (
    <div>
      <div className="font-display text-2xl font-bold tracking-tight text-ink">Gestão Controle</div>
    </div>
  )
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/')
    } catch (e) {
      setError(getErrorMessage(e, 'Não foi possível iniciar a sessão.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <AccessBrand />
        </div>

        <div className="app-card p-6 shadow-card-md sm:p-8">
          <h1 className="font-display text-2xl font-bold text-ink">Entrar</h1>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="E-mail">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Senha">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                required
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-rose/20 bg-rose/5 px-4 py-3 text-sm text-rose">
                {error}
              </div>
            )}

            <button type="submit" className="button-primary w-full py-3" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm">
            <Link to="/forgot-password" className="font-semibold text-teal hover:text-teal-dark">
              Recuperar senha
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRequestToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setRequestMessage(null)
    try {
      const { data } = await api.post<{ message: string; resetToken?: string }>('/auth/forgot-password', { email })
      setRequestMessage(data.message)
    } catch (e) {
      setError(getErrorMessage(e, 'Não foi possível gerar o token.'))
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFeedback(null)
    try {
      const { data } = await api.post<{ message: string }>('/auth/reset-password', { token: resetToken, password: newPassword })
      setFeedback(data.message)
      setResetToken('')
      setNewPassword('')
    } catch (e) {
      setError(getErrorMessage(e, 'Não foi possível redefinir a senha.'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-6">
          <Link to="/login" className="text-sm font-medium text-teal hover:text-teal-dark">
            ← Voltar para o login
          </Link>
        </div>

        <div className="mb-6">
          <AccessBrand />
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Solicite a redefinição e conclua o processo com o token autorizado pela administração da plataforma.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="app-card p-6 shadow-card-md">
            <h1 className="font-display text-xl font-bold text-ink">Solicitar redefinição</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Se o e-mail estiver ativo, uma solicitação segura será registrada para redefinição de senha.
            </p>
            <form onSubmit={handleRequestToken} className="mt-6 space-y-4">
              <Field label="E-mail">
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </Field>
              <button type="submit" className="button-primary">Solicitar acesso</button>
            </form>
            {requestMessage && (
              <div className="mt-4 rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-teal-dark">
                {requestMessage}
              </div>
            )}
          </div>

          <div className="app-card p-6 shadow-card-md">
            <h2 className="font-display text-xl font-bold text-ink">Concluir redefinição</h2>
            <p className="mt-1.5 text-sm text-slate-500">Cole o token autorizado e defina uma nova senha de acesso.</p>
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <Field label="Token">
                <TextInput value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Cole o token autorizado" required />
              </Field>
              <Field label="Nova senha">
                <TextInput
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  autoComplete="new-password"
                  required
                />
              </Field>
              <button type="submit" className="button-primary">Atualizar senha</button>
            </form>
            {feedback && (
              <div className="mt-4 rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-teal-dark">
                {feedback}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-lg border border-rose/20 bg-rose/5 px-4 py-3 text-sm text-rose">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
