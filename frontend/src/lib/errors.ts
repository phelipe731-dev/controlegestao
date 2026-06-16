import axios from 'axios'

export function getErrorMessage(error: unknown, fallback = 'Nao foi possivel concluir a operacao.') {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
