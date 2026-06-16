import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import type { DashboardSummary } from '../types/api'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="app-card p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 font-display text-4xl font-bold text-ink">{value}</div>
    </div>
  )
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
    return <div className="app-card p-8 text-slate-600">Carregando indicadores...</div>
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Apoiadores cadastrados" value={data.cards.totalSupporters} />
        <StatCard label="Lideres" value={data.cards.totalLeaders} />
        <StatCard label="Supervisores" value={data.cards.totalSupervisors} />
        <StatCard label="Cadastros no dia" value={data.cards.totalToday} />
        <StatCard label="Cadastros na semana" value={data.cards.totalWeek} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="app-card p-6">
          <div className="mb-4">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Volume diario</div>
            <h2 className="mt-2 font-display text-2xl font-bold">Cadastros por dia</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.byDay}>
                <CartesianGrid strokeDasharray="4 4" stroke="#dbe5e2" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="app-card p-6">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Ranking</div>
          <h2 className="mt-2 font-display text-2xl font-bold">Lideres por cadastro</h2>
          <div className="mt-6 space-y-3">
            {data.ranking.length === 0 ? <div className="text-sm text-slate-500">Nenhum cadastro disponivel.</div> : null}
            {data.ranking.map((item, index) => (
              <div key={item.leaderId} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">#{index + 1}</div>
                  <div className="font-semibold text-ink">{item.leaderName}</div>
                </div>
                <div className="text-2xl font-bold text-teal">{item.total}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="app-card p-6">
          <div className="mb-4">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Territorio</div>
            <h2 className="mt-2 font-display text-2xl font-bold">Cadastros por bairro</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.byNeighborhood}>
                <CartesianGrid strokeDasharray="4 4" stroke="#dbe5e2" />
                <XAxis dataKey="label" angle={-15} textAnchor="end" height={70} interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#c8843a" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="app-card p-6">
          <div className="mb-4">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Distribuicao</div>
            <h2 className="mt-2 font-display text-2xl font-bold">Cadastros por cidade</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.byCity}>
                <CartesianGrid strokeDasharray="4 4" stroke="#dbe5e2" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#0f766e" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="app-card p-6">
        <div className="mb-4">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Operacao por lider</div>
          <h2 className="mt-2 font-display text-2xl font-bold">Cadastros por lider</h2>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.byLeader}>
              <CartesianGrid strokeDasharray="4 4" stroke="#dbe5e2" />
              <XAxis dataKey="label" angle={-12} textAnchor="end" height={70} interval={0} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#102127" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
