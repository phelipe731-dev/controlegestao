import { useQuery } from '@tanstack/react-query'
import { Users, ShieldCheck, Vote, CalendarDays, TrendingUp, BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import type { DashboardSummary } from '../types/api'

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

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="app-card p-5">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <div className="section-label">{subtitle}</div>
        <h2 className="mt-1 font-display text-base font-bold text-ink">{title}</h2>
      </div>
      {children}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
    fontSize: '12px',
  },
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<DashboardSummary>('/dashboard/summary')
      return response.data
    },
  })

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="app-card h-24 animate-pulse bg-slate-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Apoiadores cadastrados"
          value={data.cards.totalSupporters}
          icon={Vote}
          color="text-teal"
          bg="bg-teal/10"
        />
        <StatCard
          label="Líderes"
          value={data.cards.totalLeaders}
          icon={Users}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="Supervisores"
          value={data.cards.totalSupervisors}
          icon={ShieldCheck}
          color="text-violet-600"
          bg="bg-violet-50"
        />
        <StatCard
          label="Cadastros hoje"
          value={data.cards.totalToday}
          icon={CalendarDays}
          color="text-amber"
          bg="bg-amber/10"
        />
        <StatCard
          label="Cadastros na semana"
          value={data.cards.totalWeek}
          icon={TrendingUp}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard title="Cadastros por dia" subtitle="Volume diário">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.byDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3, fill: '#0d9488', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Líderes por cadastro" subtitle="Ranking">
          <div className="mt-1 divide-y divide-slate-100">
            {data.ranking.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">Nenhum cadastro disponível.</div>
            ) : null}
            {data.ranking.map((item, index) => (
              <div key={item.leaderId} className="flex items-center gap-3 py-3">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${index === 0 ? 'bg-amber/20 text-amber' : 'bg-slate-100 text-slate-500'}`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.leaderName}</div>
                <div className="font-display text-lg font-bold text-teal">{item.total}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Cadastros por bairro" subtitle="Território">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.byNeighborhood}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" angle={-15} textAnchor="end" height={60} interval={0} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Cadastros por cidade" subtitle="Distribuição">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.byCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Chart row 3 */}
      <ChartCard title="Cadastros por líder" subtitle="Operação por líder">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.byLeader}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" angle={-12} textAnchor="end" height={60} interval={0} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="total" fill="#1e293b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}
