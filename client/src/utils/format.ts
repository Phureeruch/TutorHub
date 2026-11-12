// Single place to change currency or locale. The plan's demo script uses USD.
const CURRENCY = 'USD'
const LOCALE = 'en-US'

export function formatMoney(amount: number): string {
  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatRate = (hourly: number) => `${formatMoney(hourly)}/hr`

const pad = (n: number) => String(n).padStart(2, '0')

export function formatTime(iso: string | Date): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDay(iso: string | Date): string {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const formatTimeRange = (start: string | Date, end: string | Date) => `${formatTime(start)}–${formatTime(end)}`

export const formatHours = (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'}`

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local-midnight key used to group items by calendar day. */
export function dayKey(iso: string | Date): string {
  return toDateInputValue(new Date(iso))
}
