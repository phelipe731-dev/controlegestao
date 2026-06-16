import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { SettingsSummary } from '../types/api'

export function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings-summary'],
    queryFn: async () => {
      const response = await api.get<SettingsSummary>('/settings/summary')
      return response.data
    },
  })

  if (isLoading || !data) {
    return <div className="app-card p-6 text-slate-600">Carregando configuracoes...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="app-card p-6">
          <div className="text-sm text-slate-500">Auditoria</div>
          <div className="mt-2 font-display text-4xl font-bold">{data.metrics.auditCount}</div>
        </div>
        <div className="app-card p-6">
          <div className="text-sm text-slate-500">Logins registrados</div>
          <div className="mt-2 font-display text-4xl font-bold">{data.metrics.loginCount}</div>
        </div>
        <div className="app-card p-6">
          <div className="text-sm text-slate-500">Falhas de acesso</div>
          <div className="mt-2 font-display text-4xl font-bold">{data.metrics.failedLogins}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="app-card p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Privacidade</div>
          <h2 className="mt-2 font-display text-2xl font-bold">{data.privacyPolicy.title}</h2>
          <div className="mt-1 text-sm text-slate-500">Versao {data.privacyPolicy.version}</div>
          <div className="mt-6 space-y-4">
            {data.privacyPolicy.sections.map((section) => (
              <div key={section} className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4 text-sm text-slate-700">
                {section}
              </div>
            ))}
          </div>
        </div>

        <div className="app-card p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Seguranca</div>
          <h2 className="mt-2 font-display text-2xl font-bold">Controles ativos</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-sand px-4 py-4">
              <div className="text-sm text-slate-500">Hash de senha</div>
              <div className="font-semibold">{data.security.passwordHashing}</div>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-4">
              <div className="text-sm text-slate-500">Autenticacao</div>
              <div className="font-semibold">{data.security.authentication}</div>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-4">
              <div className="text-sm text-slate-500">Trilha de auditoria</div>
              <div className="font-semibold">{data.security.auditTrailEnabled ? 'Ativa' : 'Inativa'}</div>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-4">
              <div className="text-sm text-slate-500">Logs de acesso</div>
              <div className="font-semibold">{data.security.loginLogsEnabled ? 'Ativos' : 'Inativos'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
