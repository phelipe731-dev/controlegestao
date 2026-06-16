import type { ErrorRequestHandler } from 'express'
import { HttpError } from '../utils/http-error.js'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    return response.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    })
  }

  console.error(error)
  return response.status(500).json({
    message: 'Erro interno do servidor.',
  })
}
