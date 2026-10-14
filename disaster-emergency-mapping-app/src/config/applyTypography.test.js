import { describe, expect, it } from 'vitest'
import { applyTypography, typographyToCssVars } from './applyTypography.js'

function fakeRoot() {
  const props = new Map()
  return {
    props,
    style: {
      setProperty: (name, value) => props.set(name, value),
      removeProperty: (name) => props.delete(name),
    },
  }
}

describe('typographyToCssVars', () => {
  it('maps roles and properties to --type-* variables', () => {
    expect(
      typographyToCssVars({
        fontFamily: 'Inter, system-ui, sans-serif',
        body: { size: '16px', lineHeight: 1.55 },
        navItem: { size: '12px', weight: 400, activeWeight: '600' },
        loginTitle: { size: 'clamp(1.35rem, 2.4vw, 1.85rem)', weight: 700 },
      }),
    ).toEqual({
      '--type-font-family': 'Inter, system-ui, sans-serif',
      '--type-body-size': '16px',
      '--type-body-line-height': '1.55',
      '--type-nav-item-size': '12px',
      '--type-nav-item-weight': '400',
      '--type-nav-item-active-weight': '600',
      '--type-login-title-size': 'clamp(1.35rem, 2.4vw, 1.85rem)',
      '--type-login-title-weight': '700',
    })
  })

  it('drops values that are not plain sizes, weights or font names', () => {
    expect(
      typographyToCssVars({
        fontFamily: 'Inter; } body { display: none',
        navItem: { size: '12px; color: red', weight: 'bold' },
        button: { size: 'url(x)', weight: 1000 },
        navGroup: { activeWeight: 700 },
        unknownRole: { size: '12px' },
      }),
    ).toEqual({})
  })

  it('returns nothing when typography is missing', () => {
    expect(typographyToCssVars(undefined)).toEqual({})
    expect(typographyToCssVars([])).toEqual({})
  })
})

describe('applyTypography', () => {
  it('sets variables and clears ones no longer configured', () => {
    const root = fakeRoot()
    applyTypography({ button: { size: '15px', weight: 600 } }, root)
    expect(Object.fromEntries(root.props)).toEqual({
      '--type-button-size': '15px',
      '--type-button-weight': '600',
    })

    applyTypography({ button: { size: '14px' } }, root)
    expect(Object.fromEntries(root.props)).toEqual({ '--type-button-size': '14px' })

    applyTypography(undefined, root)
    expect(root.props.size).toBe(0)
  })
})
