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
