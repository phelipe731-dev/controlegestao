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

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await login(email, password)
      navigate('/')
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Nao foi possivel iniciar a sessao.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-campaign-grid px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="app-card overflow-hidden bg-ink text-white">
          <div className="h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_30%),linear-gradient(145deg,#102127,#0f766e)] p-8 sm:p-10">
            <div className="text-xs uppercase tracking-[0.3em] text-white/55">CampanhaHub</div>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Gestao segura da operacao de campanha
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/72">
              Controle apoiadores, lideres, supervisores e auditoria em um fluxo unico com consentimento LGPD registrado.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <div className="text-sm text-white/60">Cadastro protegido</div>
                <div className="mt-2 text-xl font-semibold">Sem duplicidade por CPF e titulo</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <div className="text-sm text-white/60">Auditoria ativa</div>
                <div className="mt-2 text-xl font-semibold">Logs de acesso, alteracao e transferencia</div>
              </div>
            </div>
          </div>
        </section>

        <section className="app-card p-8 sm:p-10">
          <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Acesso interno</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-ink">Entrar na plataforma</h2>
          <p className="mt-3 text-sm text-slate-600">
            Use as credenciais da equipe ou as contas seed para validar o MVP localmente.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field label="E-mail">
              <TextInput value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@campanha.local" />
            </Field>
            <Field label="Senha">
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
              />
            </Field>

            {error ? <div className="rounded-2xl border border-rose/20 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</div> : null}

            <button type="submit" className="button-primary w-full" disabled={submitting}>
              {submitting ? 'Entrando...' : 'Acessar painel'}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-600">
            Esqueceu a senha?{' '}
            <Link to="/forgot-password" className="font-semibold text-teal hover:text-ink">
              Recuperar acesso
            </Link>
          </div>

          <div className="mt-8 rounded-3xl bg-sand p-5 text-sm text-slate-700">
            <div className="font-semibold text-ink">Credenciais seed</div>
            <div className="mt-2">Administrador: `admin@campanha.local` / `Admin@123`</div>
            <div>Supervisor: `supervisor@campanha.local` / `Supervisor@123`</div>
            <div>Lider: `lider@campanha.local` / `Lider@123`</div>
          </div>
        </section>
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
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Nao foi possivel gerar o token.'))
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    try {
      const { data } = await api.post<{ message: string }>('/auth/reset-password', {
        token: resetToken,
        password: newPassword,
      })
      setFeedback(data.message)
      setResetToken('')
      setNewPassword('')
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Nao foi possivel redefinir a senha.'))
    }
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <section className="app-card p-8">
          <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Recuperacao</div>
          <h1 className="mt-3 font-display text-3xl font-bold">Gerar token de redefinicao</h1>
          <p className="mt-3 text-sm text-slate-600">
            Como este MVP nao envia e-mail, o token aparece na resposta em ambiente local.
          </p>
          <form onSubmit={handleRequestToken} className="mt-8 space-y-5">
            <Field label="E-mail">
              <TextInput value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@campanha.local" />
            </Field>
            <button type="submit" className="button-primary">
              Gerar token
            </button>
          </form>
          {requestMessage ? <div className="mt-5 rounded-2xl bg-teal/10 px-4 py-3 text-sm text-teal">{requestMessage}</div> : null}
        </section>

        <section className="app-card p-8">
          <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Nova senha</div>
          <h2 className="mt-3 font-display text-3xl font-bold">Concluir redefinicao</h2>
          <form onSubmit={handleResetPassword} className="mt-8 space-y-5">
            <Field label="Token">
              <TextInput value={resetToken} onChange={(event) => setResetToken(event.target.value)} />
            </Field>
            <Field label="Nova senha">
              <TextInput type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </Field>
            <button type="submit" className="button-primary">
              Atualizar senha
            </button>
          </form>

          {feedback ? <div className="mt-5 rounded-2xl bg-teal/10 px-4 py-3 text-sm text-teal">{feedback}</div> : null}
          {error ? <div className="mt-5 rounded-2xl bg-rose/10 px-4 py-3 text-sm text-rose">{error}</div> : null}

          <Link to="/login" className="mt-6 inline-flex text-sm font-semibold text-teal hover:text-ink">
            Voltar para o login
          </Link>
        </section>
      </div>
    </div>
  )
}
