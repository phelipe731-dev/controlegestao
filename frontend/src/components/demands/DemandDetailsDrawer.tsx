import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import clsx from 'clsx'
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Paperclip,
  Phone,
  Plus,
  UploadCloud,
  UserCircle2,
  UserRoundCog,
  X,
} from 'lucide-react'
import { Field, SelectInput, TextAreaInput } from '../FormControls'
import { api } from '../../lib/api'
import type { CabinetDemand, CabinetDemandAttachment, CabinetDemandHistoryItem, DemandResponsibleUser, DemandStatus } from '../../types/api'
import { formatDateTime } from '../../lib/format'

export type DemandDrawerTab = 'details' | 'history' | 'attachments'

export type DemandUploadQueueItem = {
  id: string
  fileName: string
  sizeBytes: number
  progress: number
  status: 'uploading' | 'success' | 'error' | 'cancelled'
  error?: string
}

type DemandDetailsDrawerProps = {
  demand: CabinetDemand | null
  responsibles: DemandResponsibleUser[]
  activeTab: DemandDrawerTab
  historyNote: string
  historyType: string
  saving: boolean
  deletingAttachmentId: string | null
  downloadingAttachmentId: string | null
  viewingAttachmentId: string | null
  uploadQueue: DemandUploadQueueItem[]
  onTab: (tab: DemandDrawerTab) => void
  onClose: () => void
  onEdit: (demand: CabinetDemand) => void
  onHistoryNote: (value: string) => void
  onHistoryType: (value: string) => void
  onHistorySubmit: () => void
  onUpdateStatus: (status: DemandStatus, note: string, responsibleUserId?: string) => void
  onUploadFiles: (files: File[]) => void
  onCancelUpload: (uploadId: string) => void
  onDownloadAttachment: (demand: CabinetDemand, attachment: CabinetDemandAttachment) => void
  onViewAttachment: (demand: CabinetDemand, attachment: CabinetDemandAttachment) => void
  onDeleteAttachment: (demand: CabinetDemand, attachment: CabinetDemandAttachment) => void
}

const drawerTabs: Array<{ key: DemandDrawerTab; label: string }> = [
  { key: 'details', label: 'Detalhes' },
  { key: 'history', label: 'Histórico' },
  { key: 'attachments', label: 'Anexos' },
]

const historyTypeOptions = [
  'Observação interna',
  'Contato com solicitante',
  'Encaminhamento',
  'Visita realizada',
  'Retorno recebido',
  'Pendência',
  'Outro',
]

const statusLabel: Record<DemandStatus, string> = {
  REQUESTED: 'Solicitada',
  IN_PROGRESS: 'Em processo',
  RESOLVED: 'Resolvida',
}

const statusClasses: Record<DemandStatus, string> = {
  REQUESTED: 'border-amber/30 bg-amber/10 text-amber',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const statusChangeNote: Record<DemandStatus, string> = {
  REQUESTED: 'Status alterado para Solicitada.',
  IN_PROGRESS: 'Status alterado para Em processo.',
  RESOLVED: 'Status alterado para Resolvida.',
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function demandCode(demand: CabinetDemand) {
  return `#DEM-${demand.id.slice(-5).toUpperCase()}`
}

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

function isImageAttachment(attachment: CabinetDemandAttachment) {
  return attachment.mimeType.startsWith('image/')
}

function attachmentIcon(attachment: CabinetDemandAttachment) {
  if (attachment.mimeType.startsWith('image/')) return FileImage
  if (attachment.mimeType.includes('pdf')) return FileText
  if (attachment.mimeType.includes('sheet') || attachment.mimeType.includes('excel') || attachment.mimeType.includes('csv')) return FileSpreadsheet
  if (attachment.mimeType.includes('zip') || attachment.mimeType.includes('rar')) return FileArchive
  return File
}

function attachmentKindLabel(attachment: CabinetDemandAttachment) {
  const extension = attachment.originalName.split('.').pop()?.toUpperCase()
  return extension || attachment.mimeType
}

function buildWhatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${normalized}`
}

function extractDemandViewData(demand: CabinetDemand) {
  const [body, metaBlock] = demand.description.split(/\n\s*\n(?=Origem: )/)
  const metadata = new Map<string, string>()

  if (metaBlock) {
    metaBlock
      .split('|')
      .map((part) => part.trim())
      .forEach((part) => {
        const [label, ...rest] = part.split(':')
        if (!label || rest.length === 0) return
        metadata.set(label.trim(), rest.join(':').trim())
      })
  }

  const addressParts = demand.requesterAddress.split(',').map((part) => part.trim()).filter(Boolean)
  const street = addressParts[0] ?? demand.requesterAddress
  const number = addressParts[1]?.startsWith('Ref:') ? '' : addressParts[1] ?? ''
  const complementPart = addressParts.find((part, index) => index > 1 && !part.startsWith('Ref:')) ?? ''
  const referencePart = addressParts.find((part) => part.startsWith('Ref:'))?.replace(/^Ref:\s*/i, '') ?? ''

  return {
    description: body?.trim() || demand.description,
    origin: metadata.get('Origem') ?? 'Não informado',
    priority: metadata.get('Prioridade') ?? 'Normal',
    postalCode: metadata.get('CEP') ?? '',
    street,
    number,
    complement: complementPart,
    referencePoint: referencePart,
  }
}

function inferTimelineEvent(item: CabinetDemandHistoryItem) {
  const note = item.note?.toLowerCase() ?? ''

  if (!item.previousStatus && /registrad|cadastrad/.test(note)) {
    return {
      key: 'created',
      title: 'Demanda cadastrada',
      description: `Status definido como ${statusLabel[item.nextStatus]}`,
      icon: Plus,
      markerClass: 'bg-emerald-500 text-white',
    }
  }

  if (item.previousStatus && item.previousStatus !== item.nextStatus) {
    if (item.previousStatus === 'RESOLVED' && item.nextStatus !== 'RESOLVED') {
      return {
        key: 'reopened',
        title: 'Demanda reaberta',
        description: `${statusLabel[item.previousStatus]} -> ${statusLabel[item.nextStatus]}`,
        icon: Clock3,
        markerClass: 'bg-amber text-white',
      }
    }

    return {
      key: item.nextStatus === 'RESOLVED' ? 'finished' : 'status',
      title: item.nextStatus === 'RESOLVED' ? 'Demanda finalizada' : 'Status atualizado',
      description: `${statusLabel[item.previousStatus]} -> ${statusLabel[item.nextStatus]}`,
      icon: item.nextStatus === 'RESOLVED' ? CheckCircle2 : Clock3,
      markerClass: item.nextStatus === 'RESOLVED' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white',
    }
  }

  if (note.includes('responsável')) {
    return {
      key: 'responsible',
      title: 'Responsável definido',
      description: item.note ?? 'Responsável atualizado.',
      icon: UserRoundCog,
      markerClass: 'bg-blue-600 text-white',
    }
  }

  if (note.includes('anexo')) {
    return {
      key: 'attachment',
      title: 'Anexo registrado',
      description: item.note ?? 'Novo anexo enviado.',
      icon: Paperclip,
      markerClass: 'bg-cyan-600 text-white',
    }
  }

  if (note.includes('editad') || note.includes('atualizada')) {
    return {
      key: 'edit',
      title: 'Dados atualizados',
      description: item.note ?? 'Dados da demanda editados.',
      icon: Edit3,
      markerClass: 'bg-slate-700 text-white',
    }
  }

  return {
    key: 'note',
    title: 'Observação adicionada',
    description: item.note ?? 'Nova atualização registrada.',
    icon: FileText,
    markerClass: 'bg-violet-600 text-white',
  }
}

function DemandStatusBadge({ status }: { status: DemandStatus }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold', statusClasses[status])}>
      {statusLabel[status]}
    </span>
  )
}

function DemandInfoCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: typeof FileText
  action?: React.ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-[14px] border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="h-4 w-4 text-slate-500" />
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function DemandDrawerSkeleton() {
  return (
    <div className="space-y-4 px-5 pb-28 pt-5 sm:px-6">
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-2/3 rounded-lg bg-slate-100" />
        <div className="h-4 w-1/2 rounded-lg bg-slate-100" />
        <div className="h-12 rounded-2xl bg-slate-100" />
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-24 rounded-2xl bg-slate-100" />
        <div className="h-24 rounded-2xl bg-slate-100" />
      </div>
    </div>
  )
}

function DemandDrawerHeader({ demand, onClose }: { demand: CabinetDemand; onClose: () => void }) {
  return (
    <header className="border-b border-slate-200/80 bg-white px-5 pb-4 pt-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="demand-drawer-title" className="font-display text-[1.9rem] font-bold leading-tight text-ink">{demand.title}</h2>
            <DemandStatusBadge status={demand.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {demandCode(demand)} <span aria-hidden="true">·</span> Criada em {formatDateTime(demand.createdAt)}
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
          aria-label="Fechar drawer"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}

function DemandTabs({
  activeTab,
  historyCount,
  attachmentCount,
  onTab,
}: {
  activeTab: DemandDrawerTab
  historyCount: number
  attachmentCount: number
  onTab: (tab: DemandDrawerTab) => void
}) {
  return (
    <div className="border-b border-slate-200/80 bg-white px-5 py-3 sm:px-6">
      <div
        role="tablist"
        aria-label="Abas do drawer da demanda"
        className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-1.5"
      >
        {drawerTabs.map((tab, index) => {
          const count = tab.key === 'history' ? historyCount : tab.key === 'attachments' ? attachmentCount : 0

          return (
            <button
              key={tab.key}
              id={`demand-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-controls={`demand-panel-${tab.key}`}
              aria-selected={activeTab === tab.key}
              tabIndex={activeTab === tab.key ? 0 : -1}
              className={clsx(
                'flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] border-b-2 px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40',
                activeTab === tab.key
                  ? 'border-teal bg-white text-ink shadow-sm'
                  : 'border-transparent text-slate-500 hover:bg-white/80 hover:text-ink',
              )}
              onClick={() => onTab(tab.key)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return
                event.preventDefault()

                if (event.key === 'Home') return onTab(drawerTabs[0].key)
                if (event.key === 'End') return onTab(drawerTabs[drawerTabs.length - 1].key)

                const direction = event.key === 'ArrowRight' ? 1 : -1
                const nextIndex = (index + direction + drawerTabs.length) % drawerTabs.length
                onTab(drawerTabs[nextIndex].key)
              }}
            >
              <span className={clsx(activeTab === tab.key && 'font-semibold')}>{tab.label}</span>
              {count > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-xs font-semibold text-slate-600">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DemandDetailsTab({
  demand,
  responsibles,
  saving,
  onEdit,
  onUpdateStatus,
}: {
  demand: CabinetDemand
  responsibles: DemandResponsibleUser[]
  saving: boolean
  onEdit: (demand: CabinetDemand) => void
  onUpdateStatus: (status: DemandStatus, note: string, responsibleUserId?: string) => void
}) {
  const details = extractDemandViewData(demand)
  const whatsappUrl = buildWhatsappUrl(demand.requesterPhone)
  const mapQuery = [details.street, details.number, demand.requesterNeighborhood, demand.requesterCity, details.postalCode]
    .filter(Boolean)
    .join(', ')
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery || demand.requesterAddress)}`

  return (
    <div className="space-y-4">
      <DemandInfoCard
        title="Descrição"
        icon={FileText}
        action={(
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
            aria-label="Editar demanda"
            onClick={() => onEdit(demand)}
          >
            <Edit3 className="h-4 w-4" />
          </button>
        )}
      >
        <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{details.description}</p>
      </DemandInfoCard>

      <DemandInfoCard title="Responsável" icon={UserRoundCog}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal/10 text-sm font-bold text-teal">
            {initials(demand.responsibleUserName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-ink">{demand.responsibleUserName ?? 'Não definido'}</div>
            <div className="text-sm text-slate-500">Equipe de Manutenção</div>
          </div>
        </div>
        <div className="mt-3">
          <Field label="Alterar responsável">
            <SelectInput
              value={demand.responsibleUserId ?? ''}
              disabled={saving}
              onChange={(event) => onUpdateStatus(demand.status, 'Responsável alterado pelos detalhes.', event.target.value)}
            >
              <option value="">Não definido</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>{responsible.name}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </DemandInfoCard>

      <DemandInfoCard title="Solicitante" icon={UserCircle2}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold text-ink">{demand.requesterName}</div>
            <div className="mt-1 text-sm text-slate-500">{demand.requesterPhone}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
              href={`tel:${demand.requesterPhone}`}
              aria-label="Ligar para solicitante"
            >
              <Phone className="h-4 w-4" />
            </a>
            {whatsappUrl ? (
              <a
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir conversa no WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </DemandInfoCard>

      <DemandInfoCard title="Localização" icon={MapPin}>
        <div className="space-y-1.5 text-sm text-slate-600">
          <div className="font-semibold text-ink">{details.street}</div>
          {details.number ? <div>Número: {details.number}</div> : null}
          {demand.requesterNeighborhood ? <div>Bairro: {demand.requesterNeighborhood}</div> : null}
          {demand.requesterCity ? <div>{demand.requesterCity}, SP</div> : null}
          {details.postalCode ? <div>CEP: {details.postalCode}</div> : null}
          {details.complement ? <div>Complemento: {details.complement}</div> : null}
          {details.referencePoint ? <div>Ponto de referência: {details.referencePoint}</div> : null}
        </div>
        <a
          className="button-secondary mt-4 min-h-[44px] px-4 py-2 text-sm"
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin className="h-4 w-4" />
          Ver no mapa
        </a>
      </DemandInfoCard>

      <DemandInfoCard title="Informações adicionais" icon={FileText}>
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-[minmax(0,1fr)_auto]">
          <span>Origem da solicitação</span>
          <strong className="text-right text-ink">{details.origin}</strong>
          <span>Quem recebeu</span>
          <strong className="text-right text-ink">{demand.createdByUserName}</strong>
          <span>Prioridade</span>
          <div className="text-right">
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {details.priority}
            </span>
          </div>
          <span>Data de criação</span>
          <strong className="text-right text-ink">{formatDateTime(demand.createdAt)}</strong>
          <span>Última atualização</span>
          <strong className="text-right text-ink">{formatDateTime(demand.updatedAt)}</strong>
        </div>
      </DemandInfoCard>
    </div>
  )
}

function DemandHistoryItem({ item, isLast }: { item: CabinetDemandHistoryItem; isLast: boolean }) {
  const event = inferTimelineEvent(item)
  const Icon = event.icon

  return (
    <div className="relative pl-12">
      {!isLast ? <div className="absolute left-[19px] top-10 h-[calc(100%-1rem)] w-px bg-slate-200" /> : null}
      <span className={clsx('absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full shadow-sm', event.markerClass)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="text-xs font-semibold text-slate-400">{formatDateTime(item.createdAt)}</div>
      <div className="mt-1 text-lg font-semibold leading-tight text-ink">{event.title}</div>
      <div className="mt-1 text-sm text-slate-500">por {item.updatedByUserName}</div>
      <div className="mt-2 text-sm text-slate-700">{event.description}</div>
      {item.note ? (
        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <div className="mb-1 font-medium text-slate-700">Observação</div>
          <div className="whitespace-pre-line">{item.note}</div>
        </div>
      ) : null}
    </div>
  )
}

function DemandHistoryForm({
  historyType,
  note,
  saving,
  textareaRef,
  onType,
  onNote,
  onSubmit,
}: {
  historyType: string
  note: string
  saving: boolean
  textareaRef: RefObject<HTMLTextAreaElement>
  onType: (value: string) => void
  onNote: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <section className="rounded-[14px] border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="text-base font-semibold text-ink">Adicionar atualização ao histórico</div>
      <div className="mt-4 space-y-4">
        <Field label="Tipo da atualização (opcional)">
          <SelectInput value={historyType} onChange={(event) => onType(event.target.value)}>
            <option value="">Selecione</option>
            {historyTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Andamento">
          <TextAreaInput
            ref={textareaRef}
            value={note}
            onChange={(event) => onNote(event.target.value)}
            placeholder="Escreva aqui o andamento da demanda..."
            className="min-h-[132px]"
          />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" className="button-primary min-h-[44px] sm:min-w-[200px]" disabled={saving || !note.trim()} onClick={onSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Registrando...' : 'Registrar atualização'}
          </button>
        </div>
      </div>
    </section>
  )
}

function DemandHistoryTab({
  historyItems,
  historyType,
  note,
  saving,
  textareaRef,
  onType,
  onNote,
  onSubmit,
}: {
  historyItems: CabinetDemandHistoryItem[]
  historyType: string
  note: string
  saving: boolean
  textareaRef: RefObject<HTMLTextAreaElement>
  onType: (value: string) => void
  onNote: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="space-y-5">
      {historyItems.length === 0 ? (
        <section className="rounded-[14px] border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
          <Clock3 className="mx-auto h-10 w-10 text-slate-300" />
          <div className="mt-3 text-base font-semibold text-ink">Nenhuma atualização registrada.</div>
          <button type="button" className="button-secondary mt-4 min-h-[44px]" onClick={() => textareaRef.current?.focus()}>
            Adicionar primeira atualização
          </button>
        </section>
      ) : (
        <section className="rounded-[14px] border border-slate-200/80 bg-white p-4 shadow-card">
          <div className="space-y-6">
            {historyItems.map((item, index) => (
              <DemandHistoryItem key={item.id} item={item} isLast={index === historyItems.length - 1} />
            ))}
          </div>
        </section>
      )}
      <DemandHistoryForm
        historyType={historyType}
        note={note}
        saving={saving}
        textareaRef={textareaRef}
        onType={onType}
        onNote={onNote}
        onSubmit={onSubmit}
      />
    </div>
  )
}

function DemandUploadArea({
  fileInputRef,
  uploadQueue,
  onFiles,
  onCancelUpload,
}: {
  fileInputRef: RefObject<HTMLInputElement>
  uploadQueue: DemandUploadQueueItem[]
  onFiles: (files: File[]) => void
  onCancelUpload: (uploadId: string) => void
}) {
  const [dragging, setDragging] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    onFiles(Array.from(fileList))
  }

  return (
    <section className="space-y-4">
      <div
        className={clsx(
          'rounded-[14px] border border-dashed bg-white px-5 py-8 text-center transition',
          dragging ? 'border-teal bg-teal/5' : 'border-slate-300',
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          multiple
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
        <div className="mt-4 text-2xl font-semibold text-ink">Adicionar arquivos</div>
        <p className="mt-2 text-sm text-slate-500">
          Arraste e solte ou <button type="button" className="font-semibold text-teal" onClick={() => fileInputRef.current?.click()}>selecione arquivos</button> do seu computador.
        </p>
        <p className="mt-2 text-sm text-slate-400">PDF, JPG, PNG e documentos permitidos · Máximo de 10 MB por arquivo.</p>
        <button type="button" className="button-primary mt-5 min-h-[44px]" onClick={() => fileInputRef.current?.click()}>
          Selecionar arquivos
        </button>
      </div>

      {uploadQueue.length > 0 ? (
        <div className="space-y-3">
          {uploadQueue.map((item) => (
            <div key={item.id} className="rounded-[14px] border border-slate-200/80 bg-white p-4 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{item.fileName}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatFileSize(item.sizeBytes)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-full min-w-[140px] sm:w-40">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-teal transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.status === 'uploading' && `${item.progress}% enviado`}
                      {item.status === 'success' && 'Upload concluído'}
                      {item.status === 'cancelled' && 'Upload cancelado'}
                      {item.status === 'error' && (item.error || 'Falha no upload')}
                    </div>
                  </div>
                  {item.status === 'uploading' ? (
                    <button type="button" className="button-ghost px-3 py-2 text-sm text-rose hover:bg-rose/10" onClick={() => onCancelUpload(item.id)}>
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function DemandAttachmentCard({
  attachment,
  deletingId,
  downloadingId,
  viewingId,
  onView,
  onDownload,
  onDelete,
}: {
  attachment: CabinetDemandAttachment
  deletingId: string | null
  downloadingId: string | null
  viewingId: string | null
  onView: (attachment: CabinetDemandAttachment) => void
  onDownload: (attachment: CabinetDemandAttachment) => void
  onDelete: (attachment: CabinetDemandAttachment) => void
}) {
  const [previewError, setPreviewError] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const Icon = attachmentIcon(attachment)

  useEffect(() => {
    if (!isImageAttachment(attachment)) return

    let active = true
    let objectUrl = ''

    async function loadPreview() {
      try {
        const response = await api.get(`/demands/${attachment.demandId}/attachments/${attachment.id}/download`, {
          responseType: 'blob',
        })
        if (!active) return
        objectUrl = window.URL.createObjectURL(response.data)
        setPreviewUrl(objectUrl)
      } catch {
        if (active) setPreviewError(true)
      }
    }

    void loadPreview()

    return () => {
      active = false
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [attachment])

  return (
    <div className="rounded-[14px] border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:w-32">
          {isImageAttachment(attachment) && !previewError && previewUrl ? (
            <img
              src={previewUrl}
              alt={attachment.originalName}
              className="h-full w-full object-cover"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Icon className="h-9 w-9" />
              <span className="text-xs font-semibold">{attachmentKindLabel(attachment)}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold text-ink">{attachment.originalName}</div>
          <div className="mt-1 text-sm text-slate-500">
            {attachmentKindLabel(attachment)} · {formatFileSize(attachment.sizeBytes)}
          </div>
          <div className="mt-3 text-sm text-slate-500">
            <div>Enviado por {attachment.uploadedByUserName}</div>
            <div>em {formatDateTime(attachment.createdAt)}</div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" className="button-secondary min-h-[44px]" disabled={viewingId === attachment.id} onClick={() => onView(attachment)}>
              {viewingId === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              Visualizar
            </button>
            <button type="button" className="button-secondary min-h-[44px]" disabled={downloadingId === attachment.id} onClick={() => onDownload(attachment)}>
              {downloadingId === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
              Baixar
            </button>
            <button type="button" className="button-danger min-h-[44px]" disabled={deletingId === attachment.id} onClick={() => onDelete(attachment)}>
              {deletingId === attachment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DemandAttachmentsTab({
  demand,
  uploadQueue,
  deletingAttachmentId,
  downloadingAttachmentId,
  viewingAttachmentId,
  fileInputRef,
  onUploadFiles,
  onCancelUpload,
  onViewAttachment,
  onDownloadAttachment,
  onDeleteAttachment,
}: {
  demand: CabinetDemand
  uploadQueue: DemandUploadQueueItem[]
  deletingAttachmentId: string | null
  downloadingAttachmentId: string | null
  viewingAttachmentId: string | null
  fileInputRef: React.RefObject<HTMLInputElement>
  onUploadFiles: (files: File[]) => void
  onCancelUpload: (uploadId: string) => void
  onViewAttachment: (attachment: CabinetDemandAttachment) => void
  onDownloadAttachment: (attachment: CabinetDemandAttachment) => void
  onDeleteAttachment: (attachment: CabinetDemandAttachment) => void
}) {
  const attachments = demand.attachments ?? []

  return (
    <div className="space-y-5">
      <DemandUploadArea fileInputRef={fileInputRef} uploadQueue={uploadQueue} onFiles={onUploadFiles} onCancelUpload={onCancelUpload} />

      <section className="space-y-4">
        <div className="text-base font-semibold text-ink">Arquivos anexados</div>
        {attachments.length === 0 ? (
          <div className="rounded-[14px] border border-slate-200/80 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-card">
            Nenhum arquivo anexado.
          </div>
        ) : (
          <div className="space-y-3">
            {attachments.map((attachment) => (
              <DemandAttachmentCard
                key={attachment.id}
                attachment={attachment}
                deletingId={deletingAttachmentId}
                downloadingId={downloadingAttachmentId}
                viewingId={viewingAttachmentId}
                onView={onViewAttachment}
                onDownload={onDownloadAttachment}
                onDelete={onDeleteAttachment}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DemandDrawerFooter({
  activeTab,
  saving,
  onClose,
  onEdit,
  onStatusChange,
  onFocusHistoryForm,
  onOpenUploader,
}: {
  activeTab: DemandDrawerTab
  saving: boolean
  onClose: () => void
  onEdit: () => void
  onStatusChange: (status: DemandStatus) => void
  onFocusHistoryForm: () => void
  onOpenUploader: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [activeTab, saving])

  return (
    <footer className="border-t border-slate-200/80 bg-white px-5 py-4 sm:px-6">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {activeTab === 'attachments' ? (
          <>
            <button type="button" className="button-secondary min-h-[44px] sm:min-w-[148px]" onClick={onClose}>
              Fechar
            </button>
            <button type="button" className="button-primary min-h-[44px] sm:min-w-[188px]" onClick={onOpenUploader}>
              Adicionar arquivo
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button-secondary min-h-[44px] sm:min-w-[176px]"
              onClick={activeTab === 'history' ? onFocusHistoryForm : onEdit}
            >
              {activeTab === 'history' ? 'Adicionar atualização' : 'Editar demanda'}
            </button>
            <div className="relative">
              <button
                type="button"
                className="button-primary min-h-[44px] w-full sm:min-w-[200px]"
                disabled={saving}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                Atualizar status
                <ChevronDown className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute bottom-[calc(100%+0.75rem)] right-0 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                  {(Object.keys(statusLabel) as DemandStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-ink"
                      onClick={() => {
                        setMenuOpen(false)
                        onStatusChange(status)
                      }}
                    >
                      <span>{statusLabel[status]}</span>
                      <span className={clsx('h-2.5 w-2.5 rounded-full', status === 'REQUESTED' ? 'bg-amber' : status === 'IN_PROGRESS' ? 'bg-blue-600' : 'bg-emerald-500')} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </footer>
  )
}

export function DemandDetailsDrawer(props: DemandDetailsDrawerProps) {
  const {
    demand,
    responsibles,
    activeTab,
    historyNote,
    historyType,
    saving,
    deletingAttachmentId,
    downloadingAttachmentId,
    viewingAttachmentId,
    uploadQueue,
    onTab,
    onClose,
    onEdit,
    onHistoryNote,
    onHistoryType,
    onHistorySubmit,
    onUpdateStatus,
    onUploadFiles,
    onCancelUpload,
    onDownloadAttachment,
    onViewAttachment,
    onDeleteAttachment,
  } = props

  const drawerRef = useRef<HTMLElement>(null)
  const historyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CabinetDemandAttachment | null>(null)

  const content = useMemo(() => {
    if (!demand) return <DemandDrawerSkeleton />

    if (activeTab === 'details') {
      return (
        <DemandDetailsTab
          demand={demand}
          responsibles={responsibles}
          saving={saving}
          onEdit={onEdit}
          onUpdateStatus={onUpdateStatus}
        />
      )
    }

    if (activeTab === 'history') {
      return (
        <DemandHistoryTab
          historyItems={demand.history}
          historyType={historyType}
          note={historyNote}
          saving={saving}
          textareaRef={historyTextareaRef}
          onType={onHistoryType}
          onNote={onHistoryNote}
          onSubmit={onHistorySubmit}
        />
      )
    }

    return (
      <DemandAttachmentsTab
        demand={demand}
        uploadQueue={uploadQueue}
        deletingAttachmentId={deletingAttachmentId}
        downloadingAttachmentId={downloadingAttachmentId}
        viewingAttachmentId={viewingAttachmentId}
        fileInputRef={fileInputRef}
        onUploadFiles={onUploadFiles}
        onCancelUpload={onCancelUpload}
        onViewAttachment={(attachment) => onViewAttachment(demand, attachment)}
        onDownloadAttachment={(attachment) => onDownloadAttachment(demand, attachment)}
        onDeleteAttachment={(attachment) => setPendingDelete(attachment)}
      />
    )
  }, [
    activeTab,
    deletingAttachmentId,
    demand,
    downloadingAttachmentId,
    historyNote,
    historyType,
    onCancelUpload,
    onDeleteAttachment,
    onDownloadAttachment,
    onEdit,
    onHistoryNote,
    onHistorySubmit,
    onHistoryType,
    onUpdateStatus,
    onUploadFiles,
    onViewAttachment,
    responsibles,
    saving,
    uploadQueue,
    viewingAttachmentId,
  ])

  useEffect(() => {
    if (!demand) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector)
    focusables?.[0]?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (pendingDelete) {
          setPendingDelete(null)
          return
        }
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const currentFocusables = drawerRef.current?.querySelectorAll<HTMLElement>(focusableSelector)
      if (!currentFocusables?.length) return

      const first = currentFocusables[0]
      const last = currentFocusables[currentFocusables.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [demand, onClose, pendingDelete])

  useEffect(() => {
    if (!pendingDelete || deletingAttachmentId) return
    const attachmentStillExists = demand?.attachments.some((attachment) => attachment.id === pendingDelete.id)
    if (!attachmentStillExists) setPendingDelete(null)
  }, [deletingAttachmentId, demand?.attachments, pendingDelete])

  if (!demand) return null

  return (
    <div className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Fechar drawer" onClick={onClose} />
      <aside
        ref={drawerRef}
        aria-modal="true"
        role="dialog"
        aria-labelledby="demand-drawer-title"
        className="absolute right-0 top-0 flex h-full w-full flex-col bg-[#fcfdff] shadow-2xl sm:w-[70vw] lg:w-[min(580px,38vw)]"
      >
        <DemandDrawerHeader demand={demand} onClose={onClose} />
        <DemandTabs activeTab={activeTab} historyCount={demand.history.length} attachmentCount={demand.attachments.length} onTab={onTab} />

        <div id={`demand-panel-${activeTab}`} role="tabpanel" aria-labelledby={`demand-tab-${activeTab}`} className="flex-1 overflow-y-auto px-5 pb-28 pt-5 sm:px-6">
          {content}
        </div>

        <div className="absolute inset-x-0 bottom-0">
          <DemandDrawerFooter
            activeTab={activeTab}
            saving={saving}
            onClose={onClose}
            onEdit={() => onEdit(demand)}
            onStatusChange={(status) => onUpdateStatus(status, statusChangeNote[status])}
            onFocusHistoryForm={() => historyTextareaRef.current?.focus()}
            onOpenUploader={() => {
              onTab('attachments')
              window.setTimeout(() => fileInputRef.current?.click(), 0)
            }}
          />
        </div>

        {pendingDelete ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/45 px-5">
            <div className="w-full max-w-sm rounded-[18px] border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose/10 text-rose">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-lg font-semibold text-ink">Excluir anexo</div>
                  <div className="text-sm text-slate-500">Essa ação não pode ser desfeita.</div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{pendingDelete.originalName}</div>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" className="button-secondary min-h-[44px]" disabled={deletingAttachmentId === pendingDelete.id} onClick={() => setPendingDelete(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="button-danger min-h-[44px]"
                  disabled={deletingAttachmentId === pendingDelete.id}
                  onClick={() => onDeleteAttachment(demand, pendingDelete)}
                >
                  {deletingAttachmentId === pendingDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirmar exclusão
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
