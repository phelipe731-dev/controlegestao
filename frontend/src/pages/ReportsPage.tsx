import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Field, SelectInput, TextInput } from '../components/FormControls'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { cpfMask, formatDateTime } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import type { Leader, ReportResponse, Supervisor, SupporterStatus } from '../types/api'

type ReportFilters = {
  leaderId: string
  supervisorId: string
  city: string
  neighborhood: string
  electoralZone: string
  periodStart: string
  periodEnd: string
  status: '' | SupporterStatus
}

export function ReportsPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<ReportFilters>({
    leaderId: '',
    supervisorId: '',
    city: '',
    neighborhood: '',
    electoralZone: '',
    periodStart: '',
    periodEnd: '',
    status: '',
  })

  const { data: leaders } = useQuery({
    queryKey: ['leaders-report-options'],
    queryFn: async () => {
      const response = await api.get<{ leaders: Leader[] }>('/leaders')
      return response.data.leaders
    },
    enabled: user?.role !== 'LEADER',
  })

  const { data: supervisors } = useQuery({
    queryKey: ['supervisors-report-options'],
    queryFn: async () => {
      const response = await api.get<{ supervisors: Supervisor[] }>('/supervisors')
      return response.data.supervisors
    },
    enabled: user?.role === 'ADMIN',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['reports', filters],
    queryFn: async () => {
      const response = await api.get<ReportResponse>('/reports/supporters', { params: filters })
      return response.data
    },
  })

  async function download(format: 'csv' | 'xlsx') {
    try {
      const response = await api.get('/reports/supporters/export', {
        params: { ...filters, format },
        responseType: 'blob',
      })
      const blob = new Blob([response.data])
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `relatorio-apoiadores.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(getErrorMessage(error, 'Nao foi possivel exportar o relatorio.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="app-card p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="section-label">Relatorio filtrado</div>
            <h2 className="mt-1 font-display text-base font-bold text-ink">Base por lider, territorio e periodo</h2>
          </div>
          <div className="flex gap-3">
            <button type="button" className="button-secondary" onClick={() => download('csv')}>
              Exportar CSV
            </button>
            <button type="button" className="button-primary" onClick={() => download('xlsx')}>
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {user?.role !== 'LEADER' ? (
            <Field label="Lider">
              <SelectInput value={filters.leaderId} onChange={(event) => setFilters((current) => ({ ...current, leaderId: event.target.value }))}>
                <option value="">Todos</option>
                {(leaders ?? []).map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}
          {user?.role === 'ADMIN' ? (
            <Field label="Supervisor">
              <SelectInput value={filters.supervisorId} onChange={(event) => setFilters((current) => ({ ...current, supervisorId: event.target.value }))}>
                <option value="">Todos</option>
                {(supervisors ?? []).map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : null}
          <Field label="Cidade">
            <TextInput value={filters.city} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} />
          </Field>
          <Field label="Bairro">
            <TextInput value={filters.neighborhood} onChange={(event) => setFilters((current) => ({ ...current, neighborhood: event.target.value }))} />
          </Field>
          <Field label="Zona eleitoral">
            <TextInput value={filters.electoralZone} onChange={(event) => setFilters((current) => ({ ...current, electoralZone: event.target.value }))} />
          </Field>
          <Field label="Data inicial">
            <TextInput type="date" value={filters.periodStart} onChange={(event) => setFilters((current) => ({ ...current, periodStart: event.target.value }))} />
          </Field>
          <Field label="Data final">
            <TextInput type="date" value={filters.periodEnd} onChange={(event) => setFilters((current) => ({ ...current, periodEnd: event.target.value }))} />
          </Field>
          <Field label="Status">
            <SelectInput value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ReportFilters['status'] }))}>
              <option value="">Todos</option>
              <option value="ACTIVE">Ativo</option>
              <option value="ARCHIVED">Arquivado</option>
              <option value="ANONYMIZED">Anonimizado</option>
            </SelectInput>
          </Field>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="app-card p-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="section-label">Resumo por lider</div>
            <h3 className="mt-1 font-display text-base font-bold text-ink">Ranking filtrado</h3>
          </div>
          <div className="mt-1 divide-y divide-slate-100">
            {(data?.summaryByLeader ?? []).map((item, index) => (
              <div key={item.leaderId} className="flex items-center gap-3 py-3">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${index === 0 ? 'bg-amber/20 text-amber' : 'bg-slate-100 text-slate-500'}`}>
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{item.leaderName}</div>
                <div className="font-display text-lg font-bold text-teal">{item.total}</div>
              </div>
            ))}
            {!data?.summaryByLeader.length ? <div className="py-6 text-center text-sm text-slate-400">Sem dados para os filtros informados.</div> : null}
          </div>
        </div>

        <div className="app-card p-6">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="section-label">Resultado</div>
              <h3 className="mt-1 font-display text-base font-bold text-ink">Cadastros encontrados</h3>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">{data?.total ?? 0} registros</div>
          </div>
          {isLoading ? <div className="text-slate-600">Gerando relatorio...</div> : null}
          {(data?.supporters ?? []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cidade</th>
                    <th>Lider</th>
                    <th>Zona</th>
                    <th>Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.supporters.map((supporter) => (
                    <tr key={supporter.id}>
                      <td>
                        <div className="font-medium text-ink">{supporter.fullName}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{cpfMask(supporter.cpf)}</div>
                      </td>
                      <td>
                        <div className="text-sm text-ink">{supporter.city}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{supporter.neighborhood}</div>
                      </td>
                      <td className="text-sm text-ink">{supporter.leaderName}</td>
                      <td className="text-sm">
                        {supporter.electoralZone} / {supporter.electoralSection}
                      </td>
                      <td className="text-xs text-slate-400">{formatDateTime(supporter.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !isLoading ? (
            <div className="text-slate-500">Nenhum cadastro corresponde aos filtros atuais.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
