import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPinned, ShieldCheck, TrendingUp, Users, X } from 'lucide-react'
import { api } from '../lib/api'
import type { TerritoriesOverview, TerritoryZone } from '../types/api'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}) {
  return (
    <div className="app-card flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 font-display text-3xl font-bold text-ink">{value}</div>
      </div>
    </div>
  )
}

function TerritoryNode({ zone, active, onClick }: { zone: TerritoryZone; active: boolean; onClick: () => void }) {
  const tones = {
    forte: 'bg-teal text-white border-teal',
    atencao: 'bg-amber/20 text-amber border-amber/40',
    expansao: 'bg-rose/10 text-rose border-rose/30',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-36 rounded-xl border p-4 text-left shadow-card transition hover:-translate-y-1 ${tones[zone.status]} ${active ? 'ring-4 ring-ink/10' : ''}`}
    >
      <div className="text-xs uppercase tracking-[0.18em] opacity-70">Bairro {zone.zone}</div>
      <div className="mt-1 font-display text-xl font-bold">{zone.label}</div>
      <div className="mt-3 text-sm">{zone.leadersCount} lideranças</div>
      <div className="text-sm opacity-80">{zone.totalSupporters} apoiadores</div>
    </button>
  )
}

export function TerritoriesPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [leadersModalOpen, setLeadersModalOpen] = useState(false)
  const territoriesQuery = useQuery({
    queryKey: ['territories'],
    queryFn: async () => {
      const response = await api.get<TerritoriesOverview>('/territories/overview')
      return response.data
    },
  })

  const overview = territoriesQuery.data
  const activeZone = useMemo(
    () => overview?.zones.find((zone) => zone.zone === selectedZone) ?? overview?.zones[0],
    [overview, selectedZone],
  )
  const activeLeaders = activeZone?.leaders ?? []

  if (!overview) {
    return <div className="app-card p-8 text-slate-600">Carregando territórios...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="section-label">Bairros</div>
        <h2 className="page-title mt-1">Mapa funcional por bairro e região</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <StatCard label="Bairros mapeados" value={overview.metrics.totalZones} icon={MapPinned} color="text-teal" bg="bg-teal/10" />
        <StatCard label="Redutos fortes" value={overview.metrics.strongholds} icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Baixa cobertura" value={overview.metrics.expansionZones} icon={TrendingUp} color="text-rose" bg="bg-rose/10" />
        <StatCard label="Lideranças mapeadas" value={overview.metrics.totalLeaders} icon={Users} color="text-blue-600" bg="bg-blue-50" />
      </div>

      <section className="lg:hidden">
        <div className="app-card p-6">
          <div className="flex items-center gap-2 section-label">
            <TrendingUp className="h-3.5 w-3.5" />
            Leitura rápida
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-ink">Cidades e capilaridade</h3>
          <div className="mt-5 space-y-3">
            {overview.cityBreakdown.map((city) => (
              <div key={city.city} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink">{city.city}</div>
                  <div className="text-2xl font-bold text-teal">{city.total}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-card p-6">
          <div className="flex items-center gap-2 section-label">
            <MapPinned className="h-3.5 w-3.5" />
            Cartografia operacional
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-ink">Clique em um bairro</h3>
          <div className="relative mt-6 max-h-[720px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,33,39,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,33,39,0.06)_1px,transparent_1px)] bg-[size:52px_52px]" />
            <div className="relative grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {overview.zones.map((zone) => (
                <TerritoryNode
                  key={`${zone.zone}-${zone.label}`}
                  zone={zone}
                  active={activeZone?.zone === zone.zone}
                  onClick={() => setSelectedZone(zone.zone)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-5 sm:p-6">
            <div className="section-label">Detalhe do bairro</div>
            <h3 className="mt-1 font-display text-base font-bold text-ink">{activeZone?.label}</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 2xl:grid-cols-1">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Referência</div>
                <div className="mt-1 font-semibold text-ink">{activeZone?.zone}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cidade</div>
                <div className="mt-1 font-semibold text-ink">{activeZone?.city}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Apoiadores</div>
                <div className="mt-1 font-semibold text-ink">{activeZone?.totalSupporters}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Lideranças</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{activeZone?.leadersCount}</span>
                  <button
                    type="button"
                    className="rounded-full border border-teal/30 px-3 py-1 text-xs font-semibold text-teal transition hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!activeZone || activeZone.leadersCount === 0}
                    onClick={() => setLeadersModalOpen(true)}
                  >
                    Ver nomes
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Regiões mapeadas</div>
                <div className="mt-1 font-semibold text-ink">{activeZone?.neighborhoodsCount}</div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</div>
                <div className={`mt-1 font-semibold capitalize ${activeZone?.status === 'expansao' ? 'text-rose' : 'text-ink'}`}>
                  {activeZone?.status === 'expansao' ? 'baixa cobertura' : activeZone ? activeZone.status : '-'}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                <span>Força territorial</span>
                <span>{activeZone?.strength ?? 0}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-teal" style={{ width: `${activeZone?.strength ?? 0}%` }} />
              </div>
            </div>
          </div>

          <div className="app-card p-6">
            <div className="section-label">Tabela de apoio</div>
            <h3 className="mt-1 font-display text-base font-bold text-ink">Bairros em ordem de prioridade</h3>
            <div className="mt-5 space-y-3">
              {overview.zones
                .slice()
                .sort((left, right) => right.strength - left.strength)
                .map((zone) => (
                  <button
                    type="button"
                    key={zone.zone}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-4 text-left"
                    onClick={() => setSelectedZone(zone.zone)}
                  >
                    <div>
                      <div className="font-semibold text-ink">{zone.label}</div>
                      <div className="text-sm text-slate-500">
                        {zone.zone} • {zone.leadersCount} lideranças • {zone.totalSupporters} apoiadores
                      </div>
                    </div>
                    <div className="text-xl font-bold text-teal">{zone.strength}%</div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </section>

      {leadersModalOpen && activeZone && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 px-4 pb-4 pt-16 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="app-card max-h-[82vh] w-full max-w-xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div>
                <div className="section-label">Lideranças do bairro</div>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">{activeZone.label}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {activeZone.city} • {activeLeaders.length} liderança{activeLeaders.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink"
                onClick={() => setLeadersModalOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto p-4">
              {activeLeaders.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeLeaders.map((leader) => (
                    <div key={`${leader.name}-${leader.phone ?? 'sem-telefone'}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-sm font-semibold text-ink">{leader.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{leader.phone ?? 'Telefone não informado'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Nenhuma liderança vinculada a este bairro.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
