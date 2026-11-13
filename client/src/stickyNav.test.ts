/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Vitest blanks CSS imports (even ?raw), so read the stylesheet from disk.
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf-8')

// jsdom has no layout, so this guards the rule itself: with a sticky nav, anchor
// jumps (skip link) and focus scrolling must stop below it (WCAG 2.4.11).
describe('sticky nav does not obscure focus targets', () => {
  it('reserves scroll padding for the sticky nav', () => {
    expect(css).toMatch(/html\s*\{[^}]*scroll-padding-top:\s*[\d.]+rem/)
  })
})
