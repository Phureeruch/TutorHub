// Single place to change currency or locale.
const CURRENCY = 'THB'
const LOCALE = 'en-US'
export const CURRENCY_SYMBOL = '฿'

export function formatMoney(amount: number): string {
  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    // "฿400", not "THB 400": the en-US default symbol for THB is the ISO code.
    currencyDisplay: 'narrowSymbol',
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

/** "AU" for "Admin User", "C" for "Charlie": the profile icon's label. */
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

/** "฿400/hr" for one price, "฿350–฿450/hr" when a tutor prices subjects differently. */
export function formatRateRange(rates: number[]): string {
  if (rates.length === 0) return ''
  const low = Math.min(...rates)
  const high = Math.max(...rates)
  return low === high ? formatRate(low) : `${formatMoney(low)}–${formatRate(high)}`
}
