import { describe, expect, it } from 'vitest'
import { applyTheme } from './theme.js'

describe('applyTheme', () => {
  it('sets the accent and pinned shades, and removes them on cleanup', () => {
    const el = document.createElement('div')
    const undo = applyTheme(el, { accent: '#0b57b5', activeFill: '#dbeafe' })
    expect(el.style.getPropertyValue('--brand')).toBe('#0b57b5')
    expect(el.style.getPropertyValue('--brand-active-fill')).toBe('#dbeafe')
    expect(el.style.getPropertyValue('--brand-mid')).toBe('')
    undo()
    expect(el.style.getPropertyValue('--brand')).toBe('')
  })

  it('ignores values that are not plain colours', () => {
    const el = document.createElement('div')
    applyTheme(el, { accent: 'red; background: url(https://evil.example)', mid: 'var(--x)', tint: 'hsl(200 50% 90%)' })
    expect(el.style.getPropertyValue('--brand')).toBe('')
    expect(el.style.getPropertyValue('--brand-mid')).toBe('')
    expect(el.style.getPropertyValue('--brand-tint')).toBe('hsl(200 50% 90%)')
  })

  it('accepts no theme', () => {
    const el = document.createElement('div')
    expect(() => applyTheme(el, undefined)()).not.toThrow()
  })
})
