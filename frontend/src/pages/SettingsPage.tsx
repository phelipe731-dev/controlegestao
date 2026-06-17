import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, FileText, LogIn } from 'lucide-react'
import { api } from '../lib/api'
import type { SettingsSummary } from '../types/api'

type StatCardProps = {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}

function StatCard({ label, value, icon: Icon, color, bg }: StatCardProps) {
  return (
    <div className="app-card flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 font-display text-3xl font-bold text-ink">{value.toLocaleString('pt-BR')}</div>
      </div>
    </div>
  )
}

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
        <StatCard
          label="Auditoria"
          value={data.metrics.auditCount}
          icon={FileText}
          color="text-teal"
          bg="bg-teal/10"
        />
        <StatCard
          label="Logins registrados"
          value={data.metrics.loginCount}
          icon={LogIn}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Falhas de acesso"
          value={data.metrics.failedLogins}
          icon={AlertTriangle}
          color="text-rose"
          bg="bg-rose/10"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="app-card p-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="section-label">Privacidade</div>
            <h2 className="mt-1 font-display text-base font-bold text-ink">{data.privacyPolicy.title}</h2>
            <div className="mt-1 text-sm text-slate-500">Versao {data.privacyPolicy.version}</div>
          </div>
          <div className="mt-5 space-y-3">
            {data.privacyPolicy.sections.map((section) => (
              <div key={section} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                {section}
              </div>
            ))}
          </div>
        </div>

        <div className="app-card p-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="section-label">Seguranca</div>
            <h2 className="mt-1 font-display text-base font-bold text-ink">Controles ativos</h2>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="text-sm text-slate-500">Hash de senha</div>
              <div className="font-semibold text-ink">{data.security.passwordHashing}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="text-sm text-slate-500">Autenticacao</div>
              <div className="font-semibold text-ink">{data.security.authentication}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="text-sm text-slate-500">Trilha de auditoria</div>
              <div className="font-semibold text-ink">{data.security.auditTrailEnabled ? 'Ativa' : 'Inativa'}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="text-sm text-slate-500">Logs de acesso</div>
              <div className="font-semibold text-ink">{data.security.loginLogsEnabled ? 'Ativos' : 'Inativos'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
