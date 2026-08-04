export function formatDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(value))
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function toInputDate(value?: string | null) {
  if (!value) {
    return ''
  }

  return new Date(value).toISOString().slice(0, 10)
}

export function statusLabel(value: string) {
  const labels: Record<string, string> = {
    ACTIVE: 'Ativo',
    INACTIVE: 'Inativo',
    ARCHIVED: 'Arquivado',
    ANONYMIZED: 'Anonimizado',
    DRAFT: 'Rascunho',
    CONNECTING: 'Conectando',
    CONNECTED: 'Conectado',
    READY: 'Pronto',
    ERROR: 'Erro',
    QUEUED: 'Na fila',
    SCHEDULED: 'Agendado',
    SENT: 'Enviado',
    FAILED: 'Falhou',
    ALL_SUPPORTERS: 'Toda a base',
    ELECTORAL_ZONE: 'Zona eleitoral',
    LEADER: 'Por lider',
    CITY: 'Por cidade',
    MANUAL_LIST: 'Lista manual',
    WHATSAPP: 'WhatsApp',
    SMS: 'SMS',
    EMAIL: 'E-mail',
    API: 'API',
    QR: 'QR Code',
    MANUAL: 'Manual',
    PRESENTIAL: 'Presencial',
    ONLINE: 'Online',
    HYBRID: 'Hibrido',
    CONFIRMED: 'Confirmado',
    COMPLETED: 'Concluido',
    CANCELLED: 'Cancelado',
    WEB_FORM: 'Formulario web',
    EVENT: 'Evento',
    PHONE: 'Telefone',
    OTHER: 'Outro',
  }

  return labels[value] ?? value
}

export function cpfMask(value?: string | null) {
  if (!value) {
    return '-'
  }

  if (value.startsWith('AUTOCPF-')) {
    return 'Não informado'
  }

  if (value.startsWith('ANON-')) {
    return 'Anonimizado'
  }

  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) {
    return value
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
