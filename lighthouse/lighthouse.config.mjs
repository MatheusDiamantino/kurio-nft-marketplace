/**
 * Versioned audit configuration consumed by scripts/lighthouse.mjs.
 * Pages are audited with the default mock scenario and real assets
 * (images, fonts, MSW worker, Socket.IO) — no audit-only shortcuts.
 */
export default {
  runs: 3,
  profiles: ['mobile', 'desktop'],
  categories: ['performance', 'accessibility', 'best-practices', 'seo'],
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
  pages: [
    { name: 'home', path: '/' },
    { name: 'nft-detail', path: '/nft/emerald-ape-042' },
  ],
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
}
