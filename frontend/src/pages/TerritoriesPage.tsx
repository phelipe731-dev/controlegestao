import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPinned, ShieldCheck, TrendingUp, Users } from 'lucide-react'
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
    expansao: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute h-28 w-40 rounded-xl border p-4 text-left shadow-card transition hover:-translate-y-1 ${tones[zone.status]} ${active ? 'ring-4 ring-ink/10' : ''}`}
      style={{
        left: `${zone.x * 18 + 4}%`,
        top: `${zone.y * 28 + 2}%`,
      }}
    >
      <div className="text-xs uppercase tracking-[0.18em] opacity-70">Zona {zone.zone}</div>
      <div className="mt-1 font-display text-xl font-bold">{zone.label}</div>
      <div className="mt-3 text-sm">{zone.totalSupporters} apoiadores</div>
    </button>
  )
}

export function TerritoriesPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
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

  if (!overview) {
    return <div className="app-card p-8 text-slate-600">Carregando territorios...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="section-label">Territorios</div>
        <h2 className="page-title mt-1">Mapa funcional por zona eleitoral</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Zonas monitoradas" value={overview.metrics.totalZones} icon={MapPinned} color="text-teal" bg="bg-teal/10" />
        <StatCard label="Redutos fortes" value={overview.metrics.strongholds} icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Expansao prioritaria" value={overview.metrics.expansionZones} icon={TrendingUp} color="text-amber" bg="bg-amber/10" />
        <StatCard label="Apoiadores mapeados" value={overview.metrics.totalSupporters} icon={Users} color="text-blue-600" bg="bg-blue-50" />
      </div>

      <section>
        <div className="app-card p-6">
          <div className="flex items-center gap-2 section-label">
            <TrendingUp className="h-3.5 w-3.5" />
            Leitura rapida
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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-card p-6">
          <div className="flex items-center gap-2 section-label">
            <MapPinned className="h-3.5 w-3.5" />
            Cartografia operacional
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-ink">Clique em uma zona</h3>
          <div className="relative mt-6 h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,33,39,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,33,39,0.06)_1px,transparent_1px)] bg-[size:52px_52px]" />
            {overview.zones.map((zone) => (
              <TerritoryNode
                key={zone.zone}
                zone={zone}
                active={activeZone?.zone === zone.zone}
                onClick={() => setSelectedZone(zone.zone)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-6">
            <div className="section-label">Detalhe da zona</div>
            <h3 className="mt-1 font-display text-base font-bold text-ink">{activeZone?.label}</h3>
            <div className="mt-4 grid gap-4 text-sm text-slate-600">
              <div>Zona eleitoral: {activeZone?.zone}</div>
              <div>Cidade: {activeZone?.city}</div>
              <div>Apoiadores: {activeZone?.totalSupporters}</div>
              <div>Lideres ativos: {activeZone?.leadersCount}</div>
              <div>Bairros mapeados: {activeZone?.neighborhoodsCount}</div>
              <div>Status: {activeZone ? activeZone.status : '-'}</div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                <span>Forca territorial</span>
                <span>{activeZone?.strength ?? 0}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-teal" style={{ width: `${activeZone?.strength ?? 0}%` }} />
              </div>
            </div>
          </div>

          <div className="app-card p-6">
            <div className="section-label">Tabela de apoio</div>
            <h3 className="mt-1 font-display text-base font-bold text-ink">Zonas em ordem de prioridade</h3>
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
                        Zona {zone.zone} • {zone.totalSupporters} apoiadores
                      </div>
                    </div>
                    <div className="text-xl font-bold text-teal">{zone.strength}%</div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
