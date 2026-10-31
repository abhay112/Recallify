import { describe, expect, it } from 'vitest'
import { siteHue, siteInitial } from './SiteIcon'

describe('siteInitial', () => {
  it('uses the first letter of the domain, upper-cased', () => {
    expect(siteInitial('example.com')).toBe('E')
  })

  it('skips a leading www.', () => {
    expect(siteInitial('www.wikipedia.org')).toBe('W')
    expect(siteInitial('www.example.com')).toBe('E')
  })

  it('falls back to a placeholder for an empty domain', () => {
    expect(siteInitial('')).toBe('?')
  })
})

describe('siteHue', () => {
  it('is stable for the same domain and stays within the hue wheel', () => {
    expect(siteHue('example.com')).toBe(siteHue('example.com'))
    for (const domain of ['a.io', 'news.ycombinator.com', 'en.wikipedia.org', '']) {
      const hue = siteHue(domain)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })

  it('gives different sites different colours', () => {
    const hues = new Set(['github.com', 'wikipedia.org', 'mdn.dev', 'nytimes.com', 'arxiv.org'].map(siteHue))
    expect(hues.size).toBeGreaterThan(3)
  })
})
