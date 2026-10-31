/** Deterministic hue from the domain, so a site keeps its colour across sessions. */
export function siteHue(domain: string): number {
  let hash = 0
  for (let i = 0; i < domain.length; i++) hash = (hash * 31 + domain.charCodeAt(i)) >>> 0
  return hash % 360
}

export function siteInitial(domain: string): string {
  return (domain.replace(/^www\./, '')[0] ?? '?').toUpperCase()
}

/**
 * Letter badge standing in for a site favicon. Fetching real favicons would mean
 * telling a third party (or the sites themselves) every domain you've saved from.
 */
export function SiteIcon({ domain }: { domain: string }) {
  return (
    <span className="site-favicon" style={{ background: `hsl(${siteHue(domain)} 55% 36%)` }} aria-hidden="true">
      {siteInitial(domain)}
    </span>
  )
}
