import bcrypt from 'bcryptjs'
import {
  PrismaClient,
  RoleName,
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
  await upsertRole(RoleName.LEADER, 'Lider com cadastro e acompanhamento dos apoiadores')

  const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123', 10)
  const supervisorPassword = await bcrypt.hash('Supervisor@123', 10)

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

  await prisma.supervisor.upsert({
    where: { userId: supervisorUser.id },
    update: { canCreateLeaders: true },
    create: {
      userId: supervisorUser.id,
      canCreateLeaders: true,
    },
  })

  const supervisorNames = ['Ana Paula Monteiro', 'Bruno Almeida Costa', 'Carla Mendes Rocha']

  for (const [index, name] of supervisorNames.entries()) {
    const sequence = index + 1
    const phone = `(11) 97000-${String(sequence).padStart(4, '0')}`
    const user = await prisma.user.upsert({
      where: { email: `supervisor${sequence}@campanha.local` },
      update: {
        roleId: supervisorRole.id,
        passwordHash: supervisorPassword,
        status: 'ACTIVE',
      },
      create: {
        roleId: supervisorRole.id,
        name,
        email: `supervisor${sequence}@campanha.local`,
        cpf: String(10000000010 + sequence),
        phone,
        phoneNormalized: normalizeDigits(phone),
        passwordHash: supervisorPassword,
        fullAddress: `Rua dos Supervisores, ${100 + sequence}`,
        city: sequence === 3 ? 'Cidade Vizinha' : 'Cidade Base',
        neighborhood: ['Centro', 'Zona Norte', 'Bela Vista'][index],
      },
    })

    await prisma.supervisor.upsert({
      where: { userId: user.id },
      update: { canCreateLeaders: true },
      create: {
        userId: user.id,
        canCreateLeaders: true,
      },
    })
  }

  await prisma.communicationChannelConfig.upsert({
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

  await prisma.communicationChannelConfig.upsert({
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

  await prisma.communicationChannelConfig.upsert({
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

  console.log('Seed concluido com perfis-base e configuracoes iniciais.')
  console.log(`Admin: ${admin.email} / ${process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123'}`)
  console.log('Supervisor: supervisor@campanha.local / Supervisor@123')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
