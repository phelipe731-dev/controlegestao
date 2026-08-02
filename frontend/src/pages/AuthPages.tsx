import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { Field, TextInput } from '../components/FormControls'

const securityHighlights = [
  'Acesso protegido por perfil de usuário',
  'Cadastros com consentimento LGPD',
  'Auditoria de acessos e alterações',
]

function AccessBrand() {
  return (
    <div>
      <div className="font-display text-2xl font-bold tracking-tight text-ink">Gestão Controle</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.32em] text-teal">Plataforma operacional</div>
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mist px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(217,119,6,0.12),_transparent_30%)]" />
      <div className="relative grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[620px] flex-col justify-between rounded-[2rem] bg-sidebar p-10 text-white shadow-card-md lg:flex">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-white/75">
              <ShieldCheck className="h-4 w-4 text-teal" />
              Ambiente restrito e auditado
            </div>
            <div className="mt-12 max-w-lg">
              <div className="font-display text-5xl font-bold leading-tight">
                Controle interno para equipes, lideranças e supervisão.
              </div>
              <p className="mt-5 text-base leading-7 text-white/65">
                Organize cadastros de campanha, acompanhe a operação territorial e mantenha os acessos sob governança.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {securityHighlights.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-teal" />
                <span className="text-sm font-medium text-white/80">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full">
            <div className="mb-8 text-center lg:text-left">
              <AccessBrand />
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Use as credenciais fornecidas pelo administrador da operação.
              </p>
            </div>

            <div className="app-card p-6 shadow-card-md sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal/10 text-teal">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-ink">Acessar plataforma</h1>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    Informe seu e-mail profissional e senha para iniciar uma sessão segura.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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
                  {submitting ? 'Validando acesso...' : 'Entrar com segurança'}
                </button>
              </form>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 text-sm">
                <span className="text-slate-500">Problemas com o acesso?</span>
                <Link to="/forgot-password" className="font-semibold text-teal hover:text-teal-dark">
                  Recuperar senha
                </Link>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs leading-5 text-slate-500">
              O uso desta plataforma é restrito a usuários autorizados. Ações realizadas no sistema podem ser registradas para auditoria e segurança.
            </div>
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
