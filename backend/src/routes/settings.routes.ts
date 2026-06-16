import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../utils/async-handler.js'

export const settingsRouter = Router()

settingsRouter.use(authenticate)

settingsRouter.get(
  '/summary',
  asyncHandler(async (_request, response) => {
    const [auditCount, loginCount, failedLogins] = await Promise.all([
      prisma.auditLog.count(),
      prisma.loginLog.count(),
      prisma.loginLog.count({ where: { success: false } }),
    ])

    response.json({
      privacyPolicy: {
        title: 'Politica de Privacidade e LGPD',
        version: 'v1',
        sections: [
          'Os dados sao coletados exclusivamente para organizacao de cadastro interno de campanha e relacionamento com apoiadores.',
          'Todo cadastro exige consentimento registrado, origem do consentimento e horario do aceite.',
          'O acesso e controlado por perfil, com logs de login e auditoria de alteracoes.',
          'Mediante solicitacao do titular, o administrador pode anonimizar ou excluir os dados respeitando a base legal aplicavel.',
        ],
      },
      security: {
        passwordHashing: 'bcrypt',
        authentication: 'JWT',
        auditTrailEnabled: true,
        loginLogsEnabled: true,
      },
      metrics: {
        auditCount,
        loginCount,
        failedLogins,
      },
    })
  }),
)
