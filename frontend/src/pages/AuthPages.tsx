import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { Field, TextInput } from '../components/FormControls'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@campanha.local')
  const [password, setPassword] = useState('Admin@123')
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

  const seeds = [
    { role: 'Admin', email: 'admin@campanha.local', password: 'Admin@123' },
    { role: 'Supervisor', email: 'supervisor@campanha.local', password: 'Supervisor@123' },
    { role: 'Líder', email: 'lider@campanha.local', password: 'Lider@123' },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal font-display text-lg font-bold text-white">
            CH
          </div>
          <div className="text-center">
            <div className="font-display text-lg font-bold text-ink">CampanhaHub</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Operação de campo</div>
          </div>
        </div>

        {/* Card */}
        <div className="app-card p-8 shadow-card-md">
          <h2 className="font-display text-xl font-bold text-ink">Entrar</h2>
          <p className="mt-1 text-sm text-slate-500">Acesse com seu e-mail e senha.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="E-mail">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@campanha.local"
              />
            </Field>
            <Field label="Senha">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-rose/20 bg-rose/5 px-4 py-3 text-sm text-rose">
                {error}
              </div>
            )}

            <button type="submit" className="button-primary w-full py-2.5" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Acessar'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            <Link to="/forgot-password" className="font-semibold text-teal hover:text-teal-dark">
              Esqueceu a senha?
            </Link>
          </div>
        </div>

        {/* Seeds de teste */}
        <div className="mt-4 app-card p-4">
          <div className="section-label mb-3">Contas de teste</div>
          <div className="space-y-2">
            {seeds.map((seed) => (
              <button
                type="button"
                key={seed.email}
                onClick={() => {
                  setEmail(seed.email)
                  setPassword(seed.password)
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left transition hover:border-teal/40 hover:bg-teal/5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-ink">{seed.role}</div>
                  <div className="truncate font-mono text-[11px] text-slate-500">{seed.email}</div>
                </div>
                <div className="ml-3 shrink-0 font-mono text-[11px] text-slate-400">{seed.password}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-center text-[11px] text-slate-400">Clique para preencher automaticamente</div>
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
      setRequestMessage(data.resetToken ? `${data.message} Token dev: ${data.resetToken}` : data.message)
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

        <div className="grid gap-5 md:grid-cols-2">
          <div className="app-card p-6 shadow-card-md">
            <h1 className="font-display text-xl font-bold text-ink">Gerar token de redefinição</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Em ambiente local, o token aparece diretamente na resposta.
            </p>
            <form onSubmit={handleRequestToken} className="mt-6 space-y-4">
              <Field label="E-mail">
                <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@campanha.local" />
              </Field>
              <button type="submit" className="button-primary">Gerar token</button>
            </form>
            {requestMessage && (
              <div className="mt-4 rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-teal-dark">
                {requestMessage}
              </div>
            )}
          </div>

          <div className="app-card p-6 shadow-card-md">
            <h2 className="font-display text-xl font-bold text-ink">Concluir redefinição</h2>
            <p className="mt-1.5 text-sm text-slate-500">Cole o token recebido e defina a nova senha.</p>
            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <Field label="Token">
                <TextInput value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Cole o token aqui" />
              </Field>
              <Field label="Nova senha">
                <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
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
