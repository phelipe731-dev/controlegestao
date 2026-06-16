export const normalizeDigits = (value?: string | null) => value?.replace(/\D/g, '') ?? ''

export const normalizeOptionalDigits = (value?: string | null) => {
  const digits = normalizeDigits(value)
  return digits.length > 0 ? digits : null
}

export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export const normalizeText = (value: string) => value.trim()

export const buildFullAddress = (payload: {
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  state: string
}) => {
  const main = `${payload.street}, ${payload.number}`
  const complement = payload.complement ? ` - ${payload.complement}` : ''
  return `${main}${complement} - ${payload.neighborhood}, ${payload.city}/${payload.state}`
}
