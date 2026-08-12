export const REDBOOTH_TIME_ZONE = 'Africa/Addis_Ababa'

export function getRedBoothBusinessDate(instant: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REDBOOTH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const values = new Map(parts.map((part) => [part.type, part.value]))
  const year = values.get('year')
  const month = values.get('month')
  const day = values.get('day')
  if (!year || !month || !day) throw new Error('Unable to determine the RedBooth business date.')
  return `${year}-${month}-${day}`
}

export function formatRedBoothDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: REDBOOTH_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(typeof value === 'string' ? new Date(value) : value)
}

export function formatRedBoothTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: REDBOOTH_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value)
}
