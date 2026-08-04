import type { ErrorRequestHandler } from 'express'
import { ZodError, type ZodIssue } from 'zod'
import { HttpError } from '../utils/http-error.js'

const fieldLabels: Record<string, string> = {
  fullName: 'nome completo',
  phone: 'telefone',
  birthDate: 'data de nascimento',
  fullAddress: 'endereco completo',
  leaderId: 'lider responsavel',
  consentAccepted: 'consentimento LGPD',
}

function formatZodIssue(issue: ZodIssue) {
  const field = String(issue.path[0] ?? '')
  const label = fieldLabels[field] ?? field

  if (field === 'fullName') {
    return 'Informe o nome completo com pelo menos 3 caracteres.'
  }

  if (field === 'phone') {
    return 'Informe um telefone valido.'
  }

  if (field === 'birthDate') {
    return 'Informe a data de nascimento.'
  }

  if (field === 'fullAddress') {
    return 'Informe o endereco completo.'
  }

  if (field === 'leaderId') {
    return 'Selecione o lider responsavel.'
  }

  if (field === 'consentAccepted') {
    return 'Confirme o consentimento LGPD.'
  }

  return label ? `Revise o campo ${label}.` : 'Revise os dados informados.'
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    return response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    })
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: formatZodIssue(issue),
    }))

    return response.status(400).json({
      message: details[0]?.message ?? 'Revise os dados informados.',
      details,
    })
  }

  console.error(error)
  return response.status(500).json({
    message: 'Erro interno do servidor.',
  })
}
