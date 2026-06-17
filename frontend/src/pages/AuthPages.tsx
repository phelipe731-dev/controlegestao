import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck, Vote, Users } from 'lucide-react'
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

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden w-[480px] shrink-0 flex-col bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal font-display text-sm font-bold text-white">
            CH
          </div>
          <div>
            <div className="font-display text-sm font-bold text-white">CampanhaHub</div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Operação de campo</div>
          </div>
        </div>

        <div className="mt-auto">
          <h1 className="font-display text-4xl font-bold leading-snug text-white">
            Gestão segura da operação de campanha
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Controle apoiadores, líderes e supervisores com auditoria completa e consentimento LGPD registrado.
          </p>

          <div className="mt-10 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <Vote className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
              <div>
                <div className="text-sm font-semibold text-white">Cadastro protegido</div>
                <div className="mt-0.5 text-xs text-white/50">Sem duplicidade por CPF e título eleitoral</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
              <div>
                <div className="text-sm font-semibold text-white">Auditoria ativa</div>
                <div className="mt-0.5 text-xs text-white/50">Logs de acesso, alteração e transferência</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
              <div>
                <div className="text-sm font-semibold text-white">Gestão hierárquica</div>
                <div className="mt-0.5 text-xs text-white/50">Admin, supervisor e líder com permissões distintas</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-mist px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal font-display text-sm font-bold text-white">
              CH
            </div>
            <div className="font-display text-sm font-bold text-ink">CampanhaHub</div>
          </div>

          <div className="app-card p-8 shadow-card-md">
            <h2 className="font-display text-2xl font-bold text-ink">Entrar na plataforma</h2>
            <p className="mt-1.5 text-sm text-slate-500">Use suas credenciais de acesso para continuar.</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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
                <div className="flex items-start gap-2 rounded-lg border border-rose/20 bg-rose/5 px-4 py-3 text-sm text-rose">
                  {error}
                </div>
              )}

              <button type="submit" className="button-primary w-full py-2.5" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Acessar painel'}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-slate-500">
              Esqueceu a senha?{' '}
              <Link to="/forgot-password" className="font-semibold text-teal hover:text-teal-dark">
                Recuperar acesso
              </Link>
            </div>
          </div>

          {/* Dev credentials */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
            <div className="mb-2 font-semibold text-slate-700">Credenciais de desenvolvimento</div>
            <div className="space-y-1 font-mono">
              <div><span className="text-slate-400">Admin:</span> admin@campanha.local / Admin@123</div>
              <div><span className="text-slate-400">Supervisor:</span> supervisor@campanha.local / Supervisor@123</div>
              <div><span className="text-slate-400">Líder:</span> lider@campanha.local / Lider@123</div>
            </div>
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
