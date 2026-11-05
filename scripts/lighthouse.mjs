#!/usr/bin/env node
/**
 * Lighthouse audit — Home and NFT detail, mobile + desktop, 3 runs each.
 *
 * Usage:  pnpm build && pnpm lighthouse
 *   (serves dist/ with `vite preview` on :4173 unless LH_BASE_URL is set)
 *
 * Output (versioned):
 *   lighthouse/summary.md / summary.json  — medians per category + LCP/CLS/TBT, environment
 *   lighthouse/reports/<page>-<profile>.report.{html,json} — the median run of each page/profile
 * Raw runs go to lighthouse/runs/ (git-ignored).
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { chromium } from '@playwright/test'
import config from '../lighthouse/lighthouse.config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'lighthouse')
const BASE = process.env.LH_BASE_URL ?? 'http://localhost:4173'

function median(values) {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server not reachable: ${url}`)
}

async function main() {
  let server
  if (!process.env.LH_BASE_URL) {
    server = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['preview'], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' })
  }
  await waitFor(BASE)

  await rm(path.join(outDir, 'runs'), { recursive: true, force: true })
  await mkdir(path.join(outDir, 'runs'), { recursive: true })
  await mkdir(path.join(outDir, 'reports'), { recursive: true })

  const chromePath = process.env.CHROME_PATH ?? chromium.executablePath()
  const results = []

  for (const page of config.pages) {
    for (const profile of config.profiles) {
      const runs = []
      for (let i = 1; i <= config.runs; i++) {
        // Fresh Chrome per run = cold cache, cold service worker (worst case).
        const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: config.chromeFlags })
        try {
          const lhConfig = profile === 'desktop' ? desktopConfig : undefined
          const url = `${BASE}${page.path}`
          const result = await lighthouse(url, { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: config.categories }, lhConfig)
          const lhr = result.lhr
          const scores = Object.fromEntries(config.categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]))
          const metrics = {
            LCP: lhr.audits['largest-contentful-paint'].numericValue,
            CLS: lhr.audits['cumulative-layout-shift'].numericValue,
            TBT: lhr.audits['total-blocking-time'].numericValue,
            FCP: lhr.audits['first-contentful-paint'].numericValue,
          }
          const base = path.join(outDir, 'runs', `${page.name}-${profile}-run${i}`)
          await writeFile(`${base}.report.html`, result.report[0])
          await writeFile(`${base}.report.json`, result.report[1])
          runs.push({ run: i, scores, metrics, html: result.report[0], json: result.report[1], lighthouseVersion: lhr.lighthouseVersion, userAgent: lhr.environment.hostUserAgent })
          console.log(`${page.name} ${profile} run ${i}:`, scores, `LCP ${Math.round(metrics.LCP)}ms CLS ${metrics.CLS.toFixed(3)} TBT ${Math.round(metrics.TBT)}ms`)
        } finally {
          await chrome.kill()
        }
      }
      const med = {
        scores: Object.fromEntries(config.categories.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        metrics: Object.fromEntries(['LCP', 'CLS', 'TBT', 'FCP'].map((m) => [m, median(runs.map((r) => r.metrics[m]))])),
      }
      // Keep the run whose performance score is the median as the representative report.
      const medianRun = [...runs].sort((a, b) => a.scores.performance - b.scores.performance)[Math.floor(runs.length / 2)]
      await writeFile(path.join(outDir, 'reports', `${page.name}-${profile}.report.html`), medianRun.html)
      await writeFile(path.join(outDir, 'reports', `${page.name}-${profile}.report.json`), medianRun.json)
      results.push({
        page: page.name,
        path: page.path,
        profile,
        median: med,
        runs: runs.map(({ run, scores, metrics }) => ({ run, scores, metrics })),
        lighthouseVersion: medianRun.lighthouseVersion,
        userAgent: medianRun.userAgent,
      })
    }
  }

  const env = {
    date: new Date().toISOString(),
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    lighthouse: results[0]?.lighthouseVersion,
    browser: results[0]?.userAgent,
    baseUrl: BASE,
    build: 'vite build (production) served by vite preview — MSW mock layer enabled, default scenario',
    throttling: 'Lighthouse defaults: mobile = simulated slow 4G + 4x CPU slowdown (Moto G Power); desktop = desktop preset',
    runsPerPageAndProfile: config.runs,
  }

  const targets = config.targets
  const pct = (n) => String(n).padStart(3)
  const lines = [
    '# Lighthouse — resultados (mediana de 3 execuções)',
    '',
    `Gerado em ${env.date} por \`pnpm lighthouse\`.`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...results.map((r) => {
      const s = r.median.scores
      const mark = (c) => (s[c] >= targets[c] ? `${pct(s[c])}` : `**${pct(s[c])}** ⚠️`)
      return `| ${r.page} (\`${r.path}\`) | ${r.profile} | ${mark('performance')} | ${mark('accessibility')} | ${mark('best-practices')} | ${mark('seo')} | ${(r.median.metrics.LCP / 1000).toFixed(2)} s | ${r.median.metrics.CLS.toFixed(3)} | ${Math.round(r.median.metrics.TBT)} ms |`
    }),
    '',
    `Metas: Performance ≥ ${targets.performance}, Accessibility ≥ ${targets.accessibility}, Best Practices ≥ ${targets['best-practices']}, SEO ≥ ${targets.seo}.`,
    '',
    '## Ambiente',
    '',
    ...Object.entries(env).map(([k, v]) => `- **${k}**: ${v}`),
    '',
    'Relatórios completos (execução mediana) em `lighthouse/reports/`.',
    '',
  ]
  await writeFile(path.join(outDir, 'summary.md'), lines.join('\n'))
  await writeFile(path.join(outDir, 'summary.json'), JSON.stringify({ env, targets, results }, null, 2))
  console.log(lines.join('\n'))

  if (server) server.kill()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
