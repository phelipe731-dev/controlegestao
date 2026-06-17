import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, MapPin, Megaphone, Plus, Users } from 'lucide-react'
import { CheckboxInput, Field, SelectInput, TextAreaInput, TextInput } from '../components/FormControls'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { formatDate, formatDateTime, statusLabel } from '../lib/format'
import type { EventsOverview } from '../types/api'

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

function JuneCalendar({ events }: { events: EventsOverview['events'] }) {
  const days = Array.from({ length: 30 }, (_, index) => index + 1)
  const eventMap = new Map(events.map((event) => [new Date(event.eventDate).getDate(), event]))
  const leadingEmptyDays = new Date('2026-06-01T00:00:00').getDay()

  return (
    <div className="grid grid-cols-7 gap-3">
      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((label) => (
        <div key={label} className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </div>
      ))}
      {Array.from({ length: leadingEmptyDays }).map((_, index) => (
        <div key={`empty-${index}`} className="min-h-28 rounded-lg border border-transparent" />
      ))}
      {days.map((day) => {
        const event = eventMap.get(day)
        return (
          <div key={day} className={`min-h-28 rounded-lg border p-3 ${event ? 'border-amber/30 bg-amber/5' : 'border-slate-100 bg-slate-50'}`}>
            <div className="text-sm font-semibold text-ink">{day}</div>
            {event ? (
              <div className="mt-2">
                <div className="text-sm font-semibold text-ink">{event.title}</div>
                <div className="mt-1 text-xs text-slate-500">{event.startTimeLabel} - {event.endTimeLabel}</div>
                <div className="mt-2 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-amber">
                  {statusLabel(event.status)}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function EventsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    title: '',
    description: '',
    eventDate: '2026-06-30',
    startTimeLabel: '19:00',
    endTimeLabel: '21:00',
    location: '',
    city: 'Cidade Base',
    neighborhood: '',
    electoralZone: '',
    capacity: 150,
    expectedAudience: 80,
    notifyAllBase: true,
    format: 'PRESENTIAL',
    status: 'DRAFT',
  })

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await api.get<EventsOverview>('/events')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => api.post('/events', form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      setForm({
        title: '',
        description: '',
        eventDate: '2026-06-30',
        startTimeLabel: '19:00',
        endTimeLabel: '21:00',
        location: '',
        city: 'Cidade Base',
        neighborhood: '',
        electoralZone: '',
        capacity: 150,
        expectedAudience: 80,
        notifyAllBase: true,
        format: 'PRESENTIAL',
        status: 'DRAFT',
      })
    },
    onError: (error) => alert(getErrorMessage(error)),
  })

  const overview = eventsQuery.data
  const upcoming = useMemo(() => overview?.events ?? [], [overview])

  if (!overview) {
    return <div className="app-card p-8 text-slate-600">Carregando agenda...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="section-label">Agenda operacional</div>
        <h2 className="page-title mt-1">Eventos, ocupacao e notificacao da base</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Eventos no radar" value={overview.metrics.total} icon={CalendarDays} color="text-teal" bg="bg-teal/10" />
        <StatCard label="Confirmados" value={overview.metrics.confirmed} icon={Users} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Avisos em massa" value={overview.metrics.notifyAllBase} icon={Megaphone} color="text-amber" bg="bg-amber/10" />
        <StatCard label="Alcance da base" value={overview.metrics.baseReach} icon={MapPin} color="text-blue-600" bg="bg-blue-50" />
      </div>

      <section>
        <div className="app-card p-6">
          <div className="flex items-center gap-2 section-label">
            <Plus className="h-3.5 w-3.5" />
            Novo evento
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-ink">Adicionar agenda de junho/2026</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Titulo">
              <TextInput value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </Field>
            <Field label="Data">
              <TextInput type="date" value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} />
            </Field>
            <Field label="Inicio">
              <TextInput value={form.startTimeLabel} onChange={(event) => setForm((current) => ({ ...current, startTimeLabel: event.target.value }))} />
            </Field>
            <Field label="Fim">
              <TextInput value={form.endTimeLabel} onChange={(event) => setForm((current) => ({ ...current, endTimeLabel: event.target.value }))} />
            </Field>
            <Field label="Local">
              <TextInput value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
            </Field>
            <Field label="Cidade">
              <TextInput value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
            </Field>
            <Field label="Bairro">
              <TextInput value={form.neighborhood} onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))} />
            </Field>
            <Field label="Zona eleitoral">
              <TextInput value={form.electoralZone} onChange={(event) => setForm((current) => ({ ...current, electoralZone: event.target.value }))} />
            </Field>
            <Field label="Formato">
              <SelectInput value={form.format} onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}>
                <option value="PRESENTIAL">Presencial</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hibrido</option>
              </SelectInput>
            </Field>
            <Field label="Status">
              <SelectInput value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="DRAFT">Rascunho</option>
                <option value="CONFIRMED">Confirmado</option>
                <option value="COMPLETED">Concluido</option>
                <option value="CANCELLED">Cancelado</option>
              </SelectInput>
            </Field>
            <Field label="Capacidade">
              <TextInput type="number" value={String(form.capacity)} onChange={(event) => setForm((current) => ({ ...current, capacity: Number(event.target.value) }))} />
            </Field>
            <Field label="Publico esperado">
              <TextInput type="number" value={String(form.expectedAudience)} onChange={(event) => setForm((current) => ({ ...current, expectedAudience: Number(event.target.value) }))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Descricao">
                <TextAreaInput value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
            </div>
          </div>
          <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <CheckboxInput checked={form.notifyAllBase} onChange={(event) => setForm((current) => ({ ...current, notifyAllBase: event.target.checked }))} />
            <span className="text-sm font-medium text-slate-700">Notificar toda a base sobre este evento</span>
          </label>
          <button type="button" className="button-primary mt-5 w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Salvando...' : 'Criar evento'}
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="app-card p-6">
          <div className="flex items-center gap-2 section-label">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendario de junho/2026
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-ink">Vista mensal</h3>
          <div className="mt-5">
            <JuneCalendar events={upcoming} />
          </div>
        </div>

        <div className="app-card p-6">
          <div className="flex items-center gap-2 section-label">
            <Megaphone className="h-3.5 w-3.5" />
            Linha do tempo
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-ink">Eventos planejados</h3>
          <div className="mt-5 space-y-4">
            {upcoming.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{event.title}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {formatDate(event.eventDate)} • {event.startTimeLabel} - {event.endTimeLabel} • {event.location}
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{statusLabel(event.status)}</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
                  <div>Formato: {statusLabel(event.format)}</div>
                  <div>Zona: {event.electoralZone || '-'}</div>
                  <div>Capacidade: {event.capacity}</div>
                  <div>Previstos: {event.expectedAudience}</div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                    <span>Ocupacao</span>
                    <span>{event.occupancyRate}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-200">
                    <div className="h-3 rounded-full bg-amber" style={{ width: `${Math.min(event.occupancyRate, 100)}%` }} />
                  </div>
                </div>
                {event.notifyAllBase ? (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-teal/10 px-3 py-2 text-sm font-medium text-teal">
                    <Users className="h-4 w-4" />
                    Evento marcado para notificar toda a base
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
