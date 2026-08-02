import axios from 'axios'

export function getErrorMessage(error: unknown, fallback = 'Não foi possível concluir a operação.') {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  return fallback
}
