/**
 * Lightweight stand-in for `tldts`, aliased in vite.config.ts.
 *
 * MSW → tough-cookie → tldts embeds the full Public Suffix List (~1.4k IDN
 * entries), which was the largest single cost of the mock chunk on throttled
 * mobile (Lighthouse TBT). tough-cookie only calls `getDomain()` to validate
 * cookie domains in MSW's in-memory cookie store; this app never relies on
 * cookies (auth uses a bearer token), so "last two labels" is sufficient.
 */
export function getDomain(hostname: string): string | null {
  if (!hostname || /^[\d.]+$/.test(hostname) || hostname.includes(':')) return null
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length < 2) return null
  return labels.slice(-2).join('.')
}

export function getPublicSuffix(hostname: string): string | null {
  const labels = hostname.toLowerCase().split('.')
  return labels.length ? labels[labels.length - 1] : null
}
