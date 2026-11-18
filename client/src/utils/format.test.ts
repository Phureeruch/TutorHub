import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatDay,
  formatHours,
  formatMoney,
  formatRate,
  formatRateRange,
  formatTime,
  initialsOf,
  toDateInputValue,
} from './format'

const iso = (hh: number, mm = 0) => new Date(2026, 10, 13, hh, mm).toISOString()

describe('formatMoney', () => {
  it('formats Thai baht and drops satang for whole amounts', () => {
    expect(formatMoney(400)).toBe('฿400')
  })

  it('keeps two decimals otherwise', () => {
    expect(formatMoney(337.5)).toBe('฿337.50')
  })

  it('groups thousands', () => {
    expect(formatMoney(1250)).toBe('฿1,250')
  })
})

describe('formatRate', () => {
  it('appends per hour', () => {
    expect(formatRate(400)).toBe('฿400/hr')
  })
})

describe('formatTime', () => {
  it('uses 24-hour local time', () => {
    expect(formatTime(iso(9, 30))).toBe('09:30')
    expect(formatTime(iso(15))).toBe('15:00')
  })
})

describe('formatDay', () => {
  it('shows weekday, day and month', () => {
    expect(formatDay(iso(9))).toBe('Fri 13 Nov')
  })
})

describe('formatHours', () => {
  it.each([
    [1, '1 hour'],
    [3, '3 hours'],
  ])('%i → %s', (n, text) => {
    expect(formatHours(n)).toBe(text)
  })
})

describe('toDateInputValue', () => {
  it('formats a local date for <input type=date>', () => {
    expect(toDateInputValue(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [245_760, '240 KB'],
    [3_670_016, '3.5 MB'],
  ])('%i → %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text)
  })
})

describe('initialsOf (profile icon)', () => {
  it('uses the first letters of up to two words', () => {
    expect(initialsOf('Admin User')).toBe('AU')
    expect(initialsOf('  charlie ')).toBe('C')
    expect(initialsOf('Ann Marie de Vries')).toBe('AM')
  })
})

describe('formatRateRange (tutor card header)', () => {
  it('shows one rate when every subject costs the same', () => {
    expect(formatRateRange([400, 400])).toBe('฿400/hr')
  })

  it('shows the lowest to highest rate when they differ', () => {
    expect(formatRateRange([450, 350, 400])).toBe('฿350–฿450/hr')
  })

  it('is empty when the tutor has no priced subjects', () => {
    expect(formatRateRange([])).toBe('')
  })
})
