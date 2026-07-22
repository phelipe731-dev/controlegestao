export type Role = 'ADMIN' | 'SUPERVISOR' | 'LEADER'
export type UserStatus = 'ACTIVE' | 'INACTIVE'
export type SupporterStatus = 'ACTIVE' | 'ARCHIVED' | 'ANONYMIZED'
export type ConsentSource = 'WEB_FORM' | 'PRESENTIAL' | 'EVENT' | 'WHATSAPP' | 'PHONE' | 'OTHER'
export type CommunicationChannelType = 'WHATSAPP' | 'SMS' | 'EMAIL'
export type CommunicationMode = 'API' | 'QR' | 'MANUAL'
export type CommunicationChannelStatus = 'DRAFT' | 'CONNECTING' | 'CONNECTED' | 'READY' | 'ERROR'
export type CampaignStatus = 'DRAFT' | 'QUEUED' | 'SCHEDULED' | 'SENT' | 'FAILED'
export type CampaignAudienceType = 'ALL_SUPPORTERS' | 'CITY' | 'ELECTORAL_ZONE' | 'LEADER'
export type EventStatus = 'DRAFT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
export type EventFormat = 'PRESENTIAL' | 'ONLINE' | 'HYBRID'

export type CurrentUser = {
  id: string
  name: string
  email: string
  cpf: string
  phone: string | null
  status: UserStatus
  city: string | null
  neighborhood: string | null
  fullAddress: string | null
  role: Role
  leaderId: string | null
  supervisorId: string | null
  canCreateLeaders: boolean
}

export type Leader = {
  id: string
  name: string
  cpf: string
  phone: string | null
  email: string
  fullAddress: string | null
  city: string | null
  neighborhood: string | null
  status: UserStatus
  supervisorId: string | null
  supervisorName: string | null
  supportersCount: number
  createdRegistrations: number
  userId: string
  createdAt: string
  updatedAt: string
}

export type Supervisor = {
  id: string
  name: string
  cpf: string
  phone: string | null
  email: string
  fullAddress: string | null
  city: string | null
  neighborhood: string | null
  status: UserStatus
  canCreateLeaders: boolean
  leadersCount: number
  userId: string
  createdAt: string
  updatedAt: string
}

export type Supporter = {
  id: string
  fullName: string
  cpf: string
  phone: string | null
  birthDate: string
  fullAddress: string
  postalCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  voterRegistration: string
  electoralZone: string
  electoralSection: string
  notes: string | null
  consentAccepted: boolean
  consentSource: ConsentSource
  consentAcceptedAt: string
  status: SupporterStatus
  leaderId: string
  leaderName: string
  supervisorName: string | null
  createdByUserId: string
  createdByUserName: string
  createdAt: string
  updatedAt: string
}

export type DashboardSummary = {
  cards: {
    totalSupporters: number
    totalLeaders: number
    totalSupervisors: number
    totalToday: number
    totalWeek: number
  }
  ranking: Array<{
    leaderId: string
    leaderName: string
    total: number
  }>
  charts: {
    byDay: Array<{ date: string; total: number }>
    byLeader: Array<{ label: string; total: number }>
    byNeighborhood: Array<{ label: string; total: number }>
    byCity: Array<{ label: string; total: number }>
    byElectoralZone: Array<{ label: string; total: number }>
  }
}

export type ReportResponse = {
  filters: Record<string, string | undefined>
  total: number
  supporters: Supporter[]
  summaryByLeader: Array<{
    leaderId: string
    leaderName: string
    total: number
  }>
}

export type SettingsSummary = {
  privacyPolicy: {
    title: string
    version: string
    sections: string[]
  }
  security: {
    passwordHashing: string
    authentication: string
    auditTrailEnabled: boolean
    loginLogsEnabled: boolean
  }
  metrics: {
    auditCount: number
    loginCount: number
    failedLogins: number
  }
}

export type CommunicationChannel = {
  id: string
  name: string
  type: CommunicationChannelType
  mode: CommunicationMode
  status: CommunicationChannelStatus
  providerName: string | null
  apiBaseUrl: string | null
  senderId: string | null
  phoneNumber: string | null
  qrToken: string | null
  isDefault: boolean
  lastSyncAt: string | null
}

export type CommunicationCampaign = {
  id: string
  title: string
  subject: string | null
  body: string
  status: CampaignStatus
  audienceType: CampaignAudienceType
  city: string | null
  electoralZone: string | null
  leaderId: string | null
  notifyAllBase: boolean
  scheduledAt: string | null
  sentAt: string | null
  channelName: string
  channelType: CommunicationChannelType
  createdByName: string
  recipientsCount: number
  deliveredCount: number
  createdAt: string
}

export type CommunicationInboxItem = {
  id: string
  senderName: string
  senderAddress: string
  channelType: CommunicationChannelType
  subject: string | null
  body: string
  receivedAt: string
  readAt: string | null
  supporterName: string | null
  channelName: string | null
}

export type CommunicationsOverview = {
  metrics: {
    connectedChannels: number
    queuedCampaigns: number
    unreadInbox: number
    baseReach: number
  }
  channels: CommunicationChannel[]
  campaigns: CommunicationCampaign[]
  inbox: CommunicationInboxItem[]
}

export type CampaignEvent = {
  id: string
  title: string
  description: string | null
  eventDate: string
  startTimeLabel: string
  endTimeLabel: string
  location: string
  city: string
  neighborhood: string | null
  electoralZone: string | null
  capacity: number
  expectedAudience: number
  notifyAllBase: boolean
  format: EventFormat
  status: EventStatus
  occupancyRate: number
  createdAt: string
  updatedAt: string
}

export type EventsOverview = {
  metrics: {
    total: number
    confirmed: number
    notifyAllBase: number
    baseReach: number
  }
  events: CampaignEvent[]
}

export type TerritoryZone = {
  zone: string
  label: string
  city: string
  x: number
  y: number
  totalSupporters: number
  strength: number
  leadersCount: number
  neighborhoodsCount: number
  status: 'forte' | 'atencao' | 'expansao'
}

export type TerritoriesOverview = {
  metrics: {
    totalZones: number
    strongholds: number
    expansionZones: number
    totalSupporters: number
    totalLeaders: number
  }
  zones: TerritoryZone[]
  cityBreakdown: Array<{
    city: string
    total: number
  }>
}
