import bcrypt from 'bcryptjs'
import {
  PrismaClient,
  RoleName,
  CampaignAudienceType,
  CampaignRecipientStatus,
  CampaignStatus,
  CommunicationChannelStatus,
  CommunicationMode,
  CommunicationChannelType,
  EventFormat,
  EventStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

const normalizeDigits = (value: string) => value.replace(/\D/g, '')

async function upsertRole(name: RoleName, description: string) {
  return prisma.role.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  })
}

async function main() {
  const adminRole = await upsertRole(RoleName.ADMIN, 'Administrador com acesso total')
  const supervisorRole = await upsertRole(RoleName.SUPERVISOR, 'Supervisor com visibilidade dos lideres vinculados')
  const leaderRole = await upsertRole(RoleName.LEADER, 'Lider com cadastro e acompanhamento dos apoiadores')

  const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123', 10)
  const supervisorPassword = await bcrypt.hash('Supervisor@123', 10)
  const leaderPassword = await bcrypt.hash('Lider@123', 10)

  const admin = await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@campanha.local' },
    update: {
      roleId: adminRole.id,
      passwordHash: adminPassword,
      status: 'ACTIVE',
    },
    create: {
      roleId: adminRole.id,
      name: 'Administrador da Campanha',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@campanha.local',
      cpf: '00000000001',
      phone: '(11) 99000-0001',
      phoneNormalized: normalizeDigits('(11) 99000-0001'),
      passwordHash: adminPassword,
      fullAddress: 'Rua Central, 100',
      city: 'Cidade Base',
      neighborhood: 'Centro',
    },
  })

  const supervisorUser = await prisma.user.upsert({
    where: { email: 'supervisor@campanha.local' },
    update: {
      roleId: supervisorRole.id,
      passwordHash: supervisorPassword,
    },
    create: {
      roleId: supervisorRole.id,
      name: 'Supervisor Regional',
      email: 'supervisor@campanha.local',
      cpf: '00000000002',
      phone: '(11) 99000-0002',
      phoneNormalized: normalizeDigits('(11) 99000-0002'),
      passwordHash: supervisorPassword,
      fullAddress: 'Avenida das Equipes, 200',
      city: 'Cidade Base',
      neighborhood: 'Zona Norte',
    },
  })

  const supervisor = await prisma.supervisor.upsert({
    where: { userId: supervisorUser.id },
    update: { canCreateLeaders: true },
    create: {
      userId: supervisorUser.id,
      canCreateLeaders: true,
    },
  })

  const leaderUser = await prisma.user.upsert({
    where: { email: 'lider@campanha.local' },
    update: {
      roleId: leaderRole.id,
      passwordHash: leaderPassword,
    },
    create: {
      roleId: leaderRole.id,
      name: 'Lider de Campo',
      email: 'lider@campanha.local',
      cpf: '00000000003',
      phone: '(11) 99000-0003',
      phoneNormalized: normalizeDigits('(11) 99000-0003'),
      passwordHash: leaderPassword,
      fullAddress: 'Rua dos Lideres, 300',
      city: 'Cidade Base',
      neighborhood: 'Zona Oeste',
    },
  })

  const leader = await prisma.leader.upsert({
    where: { userId: leaderUser.id },
    update: {
      supervisorId: supervisor.id,
    },
    create: {
      userId: leaderUser.id,
      supervisorId: supervisor.id,
    },
  })

  const supportersSeed = [
    {
      fullName: 'Apoiadora Exemplo',
      cpf: '12345678901',
      phone: '(11) 98888-0001',
      birthDate: new Date('1990-04-10'),
      postalCode: '01010-000',
      street: 'Rua das Flores',
      number: '55',
      complement: 'Casa',
      neighborhood: 'Jardim Central',
      city: 'Cidade Base',
      state: 'SP',
      voterRegistration: '123456789012',
      electoralZone: '101',
      electoralSection: '22',
      notes: 'Cadastro inicial para demonstracao do dashboard.',
    },
    {
      fullName: 'Carlos Nogueira',
      cpf: '12345678902',
      phone: '(11) 98888-0002',
      birthDate: new Date('1985-08-19'),
      postalCode: '02020-000',
      street: 'Rua da Matriz',
      number: '120',
      complement: null,
      neighborhood: 'Centro Expandido',
      city: 'Cidade Base',
      state: 'SP',
      voterRegistration: '123456789013',
      electoralZone: '102',
      electoralSection: '18',
      notes: 'Prefere contato por WhatsApp.',
    },
    {
      fullName: 'Livia Santos',
      cpf: '12345678903',
      phone: '(11) 98888-0003',
      birthDate: new Date('1994-02-03'),
      postalCode: '03030-000',
      street: 'Avenida Horizonte',
      number: '88',
      complement: 'Apto 22',
      neighborhood: 'Zona Leste',
      city: 'Cidade Base',
      state: 'SP',
      voterRegistration: '123456789014',
      electoralZone: '103',
      electoralSection: '41',
      notes: 'Atua como mobilizadora local.',
    },
    {
      fullName: 'Renato Menezes',
      cpf: '12345678904',
      phone: '(11) 98888-0004',
      birthDate: new Date('1979-11-14'),
      postalCode: '04040-000',
      street: 'Travessa Sul',
      number: '15',
      complement: null,
      neighborhood: 'Zona Sul',
      city: 'Cidade Base',
      state: 'SP',
      voterRegistration: '123456789015',
      electoralZone: '104',
      electoralSection: '33',
      notes: 'Interessado em agenda de bairro.',
    },
    {
      fullName: 'Marta Ferreira',
      cpf: '12345678905',
      phone: '(11) 98888-0005',
      birthDate: new Date('1988-01-22'),
      postalCode: '05050-000',
      street: 'Rua do Bosque',
      number: '245',
      complement: null,
      neighborhood: 'Zona Oeste',
      city: 'Cidade Base',
      state: 'SP',
      voterRegistration: '123456789016',
      electoralZone: '105',
      electoralSection: '12',
      notes: 'Pode apoiar eventos de rua.',
    },
    {
      fullName: 'Joana Ramos',
      cpf: '12345678906',
      phone: '(11) 98888-0006',
      birthDate: new Date('1997-05-30'),
      postalCode: '06060-000',
      street: 'Rua das Acacias',
      number: '300',
      complement: 'Fundos',
      neighborhood: 'Bela Vista',
      city: 'Cidade Vizinha',
      state: 'SP',
      voterRegistration: '123456789017',
      electoralZone: '106',
      electoralSection: '27',
      notes: 'Base importante para expansao metropolitana.',
    },
  ]

  for (const record of supportersSeed) {
    const fullAddress = `${record.street}, ${record.number}${record.complement ? ` - ${record.complement}` : ''} - ${record.neighborhood}, ${record.city}/${record.state}`
    const existingSupporter = await prisma.supporter.findUnique({
      where: { cpf: record.cpf },
    })

    let supporterId = existingSupporter?.id

    if (!existingSupporter) {
      const supporter = await prisma.supporter.create({
        data: {
          fullName: record.fullName,
          cpf: record.cpf,
          phone: record.phone,
          phoneNormalized: normalizeDigits(record.phone),
          birthDate: record.birthDate,
          fullAddress,
          postalCode: record.postalCode,
          street: record.street,
          number: record.number,
          complement: record.complement,
          neighborhood: record.neighborhood,
          city: record.city,
          state: record.state,
          voterRegistration: record.voterRegistration,
          electoralZone: record.electoralZone,
          electoralSection: record.electoralSection,
          notes: record.notes,
          consentAccepted: true,
          consentSource: 'WEB_FORM',
          consentAcceptedAt: new Date(),
          leaderId: leader.id,
          createdByUserId: leaderUser.id,
        },
      })

      supporterId = supporter.id

      await prisma.supporterConsent.create({
        data: {
          supporterId: supporter.id,
          accepted: true,
          source: 'WEB_FORM',
          recordedByUserId: leaderUser.id,
          acceptedAt: supporter.consentAcceptedAt,
          ipAddress: '127.0.0.1',
          consentTextVersion: 'v1',
        },
      })
    }

    if (!supporterId) {
      continue
    }
  }

  const whatsappApi = await prisma.communicationChannelConfig.upsert({
    where: { id: 'channel_whatsapp_api' },
    update: {
      status: CommunicationChannelStatus.READY,
      providerName: 'Z-API / Evolution',
      apiBaseUrl: 'https://api.exemplo-whatsapp.local',
      senderId: 'campanha-hub',
      isDefault: true,
    },
    create: {
      id: 'channel_whatsapp_api',
      name: 'WhatsApp API Oficial',
      type: CommunicationChannelType.WHATSAPP,
      mode: CommunicationMode.API,
      status: CommunicationChannelStatus.READY,
      providerName: 'Z-API / Evolution',
      apiBaseUrl: 'https://api.exemplo-whatsapp.local',
      senderId: 'campanha-hub',
      isDefault: true,
      apiToken: 'token-demo-whatsapp',
    },
  })

  const whatsappQr = await prisma.communicationChannelConfig.upsert({
    where: { id: 'channel_whatsapp_qr' },
    update: {
      status: CommunicationChannelStatus.CONNECTING,
      phoneNumber: '(11) 99999-1000',
      qrToken: 'PAIR-CAMPANHA-QR-2026',
    },
    create: {
      id: 'channel_whatsapp_qr',
      name: 'WhatsApp Business QR',
      type: CommunicationChannelType.WHATSAPP,
      mode: CommunicationMode.QR,
      status: CommunicationChannelStatus.CONNECTING,
      phoneNumber: '(11) 99999-1000',
      qrToken: 'PAIR-CAMPANHA-QR-2026',
    },
  })

  const smsChannel = await prisma.communicationChannelConfig.upsert({
    where: { id: 'channel_sms' },
    update: {
      status: CommunicationChannelStatus.READY,
      providerName: 'Twilio / Zenvia',
      senderId: 'CAMPANHA',
    },
    create: {
      id: 'channel_sms',
      name: 'Gateway SMS',
      type: CommunicationChannelType.SMS,
      mode: CommunicationMode.API,
      status: CommunicationChannelStatus.READY,
      providerName: 'Twilio / Zenvia',
      senderId: 'CAMPANHA',
      apiBaseUrl: 'https://api.exemplo-sms.local',
      apiToken: 'token-demo-sms',
    },
  })

  await prisma.communicationChannelConfig.upsert({
    where: { id: 'channel_email' },
    update: {
      status: CommunicationChannelStatus.READY,
      providerName: 'SMTP / SendGrid',
      senderId: 'contato@campanha.local',
    },
    create: {
      id: 'channel_email',
      name: 'E-mail de campanha',
      type: CommunicationChannelType.EMAIL,
      mode: CommunicationMode.API,
      status: CommunicationChannelStatus.READY,
      providerName: 'SMTP / SendGrid',
      senderId: 'contato@campanha.local',
      apiBaseUrl: 'https://api.exemplo-email.local',
      apiToken: 'token-demo-email',
    },
  })

  const allSupporters = await prisma.supporter.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const launchCampaign = await prisma.communicationCampaign.upsert({
    where: { id: 'campaign_mass_june' },
    update: {
      status: CampaignStatus.QUEUED,
      notifyAllBase: true,
    },
    create: {
      id: 'campaign_mass_june',
      title: 'Convite geral para agenda regional',
      subject: 'Agenda de mobilizacao',
      body: 'Estamos organizando uma rodada de encontros por bairro. Confirme sua presenca e compartilhe com apoiadores proximos.',
      channelConfigId: whatsappApi.id,
      status: CampaignStatus.QUEUED,
      audienceType: CampaignAudienceType.ALL_SUPPORTERS,
      notifyAllBase: true,
      createdByUserId: admin.id,
    },
  })

  for (const supporter of allSupporters) {
    await prisma.campaignRecipient.upsert({
      where: {
        campaignId_supporterId: {
          campaignId: launchCampaign.id,
          supporterId: supporter.id,
        },
      },
      update: {
        status: CampaignRecipientStatus.QUEUED,
      },
      create: {
        campaignId: launchCampaign.id,
        supporterId: supporter.id,
        status: CampaignRecipientStatus.QUEUED,
      },
    })
  }

  const inboxMessages = [
    {
      id: 'inbox_1',
      channelConfigId: whatsappQr.id,
      supporterId: allSupporters[0]?.id ?? null,
      senderName: 'Apoiadora Exemplo',
      senderAddress: '(11) 98888-0001',
      channelType: CommunicationChannelType.WHATSAPP,
      subject: null,
      body: 'Conseguimos levar mais duas pessoas para o evento de sabado?',
      receivedAt: new Date('2026-06-14T10:15:00'),
    },
    {
      id: 'inbox_2',
      channelConfigId: smsChannel.id,
      supporterId: allSupporters[3]?.id ?? null,
      senderName: 'Renato Menezes',
      senderAddress: '(11) 98888-0004',
      channelType: CommunicationChannelType.SMS,
      subject: null,
      body: 'Recebi o lembrete do encontro, confirmo presenca.',
      receivedAt: new Date('2026-06-14T14:40:00'),
    },
    {
      id: 'inbox_3',
      channelConfigId: 'channel_email',
      supporterId: allSupporters[5]?.id ?? null,
      senderName: 'Joana Ramos',
      senderAddress: 'joana.ramos@email.local',
      channelType: CommunicationChannelType.EMAIL,
      subject: 'Material de bairro',
      body: 'Gostaria de receber a arte adaptada para a Cidade Vizinha ainda hoje.',
      receivedAt: new Date('2026-06-15T08:05:00'),
    },
  ]

  for (const message of inboxMessages) {
    await prisma.communicationInboxMessage.upsert({
      where: { id: message.id },
      update: {
        body: message.body,
        receivedAt: message.receivedAt,
      },
      create: message,
    })
  }

  const events = [
    {
      id: 'event_1',
      title: 'Encontro de liderancas da Zona Norte',
      description: 'Alinhamento de discurso, distribuicao de material e definicao de metas semanais.',
      eventDate: new Date('2026-06-18T00:00:00'),
      startTimeLabel: '18:30',
      endTimeLabel: '20:30',
      location: 'Centro Comunitario Nova Esperanca',
      city: 'Cidade Base',
      neighborhood: 'Zona Norte',
      electoralZone: '101',
      capacity: 120,
      expectedAudience: 94,
      notifyAllBase: false,
      format: EventFormat.PRESENTIAL,
      status: EventStatus.CONFIRMED,
      createdByUserId: admin.id,
    },
    {
      id: 'event_2',
      title: 'Mutirao digital de WhatsApp',
      description: 'Aquecimento de rede e envio coordenado de convites para a semana final.',
      eventDate: new Date('2026-06-21T00:00:00'),
      startTimeLabel: '19:00',
      endTimeLabel: '20:00',
      location: 'Sala virtual Teams',
      city: 'Cidade Base',
      neighborhood: 'Online',
      electoralZone: '103',
      capacity: 250,
      expectedAudience: 180,
      notifyAllBase: true,
      format: EventFormat.ONLINE,
      status: EventStatus.CONFIRMED,
      createdByUserId: admin.id,
    },
    {
      id: 'event_3',
      title: 'Caminhada metropolitana',
      description: 'Ato regional com concentracao e ativacao simultanea por territorio.',
      eventDate: new Date('2026-06-27T00:00:00'),
      startTimeLabel: '09:00',
      endTimeLabel: '12:00',
      location: 'Praca da Estacao',
      city: 'Cidade Vizinha',
      neighborhood: 'Centro',
      electoralZone: '106',
      capacity: 500,
      expectedAudience: 420,
      notifyAllBase: true,
      format: EventFormat.HYBRID,
      status: EventStatus.DRAFT,
      createdByUserId: admin.id,
    },
  ]

  for (const event of events) {
    await prisma.campaignEvent.upsert({
      where: { id: event.id },
      update: {
        title: event.title,
        expectedAudience: event.expectedAudience,
        notifyAllBase: event.notifyAllBase,
        status: event.status,
      },
      create: event,
    })
  }

  console.log('Seed concluido com usuarios de demonstracao.')
  console.log(`Admin: ${admin.email} / ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123'}`)
  console.log('Supervisor: supervisor@campanha.local / Supervisor@123')
  console.log('Lider: lider@campanha.local / Lider@123')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
