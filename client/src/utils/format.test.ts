import { describe, expect, it } from 'vitest'
import { formatDay, formatHours, formatMoney, formatRate, formatTime, toDateInputValue } from './format'

const iso = (hh: number, mm = 0) => new Date(2026, 10, 13, hh, mm).toISOString()

describe('formatMoney', () => {
  it('drops cents for whole amounts', () => {
    expect(formatMoney(40)).toBe('$40')
  })

  it('keeps two decimals otherwise', () => {
    expect(formatMoney(37.5)).toBe('$37.50')
  })

  it('groups thousands', () => {
    expect(formatMoney(1250)).toBe('$1,250')
  })
})

describe('formatRate', () => {
  it('appends per hour', () => {
    expect(formatRate(40)).toBe('$40/hr')
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
