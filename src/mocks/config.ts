/**
 * Mock scenario & network-condition configuration.
 *
 * Selection order (first wins): URL query (?scenario=…&latency=…) →
 * localStorage → defaults. Values chosen via the URL are persisted so they
 * survive navigation and refresh. `?mock-reset=1` restores the seed data.
 */

export const SCENARIOS = {
  default: 'Fluxo feliz com dados de seed',
  'catalog-empty': 'Catálogo sempre vazio',
  'catalog-error': 'Catálogo responde 500 em todas as tentativas',
  'flaky': 'Primeira tentativa de cada GET falha com 503; as próximas funcionam',
  'out-of-order': 'Respostas do catálogo chegam fora de ordem (as mais antigas são mais lentas)',
  offline: 'Sem conexão: todas as requisições REST falham na rede',
  'favorite-fail': 'Inclusão/remoção de favoritos falha com 500',
  'session-expired': 'Toda requisição autenticada responde 401 SESSION_EXPIRED',
  'price-change-checkout': 'Preço do 1º item muda (+0.10 ETH) ao confirmar a compra',
  'sold-out-checkout': 'Edição do 1º item esgota ao confirmar a compra',
  'order-timeout': 'Pedido é criado, mas a 1ª resposta é 504; reenvio com a mesma chave recupera',
  'payment-declined': 'Pagamento é recusado após ficar pendente',
  'payment-hold': 'Pagamento fica pendente até ser resolvido manualmente (__kurio.resolveOrder)',
  'wallet-reject': 'Carteira recusa a conexão',
  'validation-error': 'Perfil e carteiras respondem 422 com erros de campo',
} as const

export type ScenarioId = keyof typeof SCENARIOS

export const LATENCIES = {
  none: 'Sem latência (testes)',
  fast: '150–300 ms',
  slow: '2.5 s fixos',
  variable: '100–1800 ms (determinística por requisição)',
} as const

export type LatencyId = keyof typeof LATENCIES

export interface MockConfig {
  scenario: ScenarioId
  latency: LatencyId
  /** Delay in ms before a pending order resolves (confirmed/declined). */
  orderResolutionMs: number
}

const STORAGE_KEY = 'kurio.mock.config'

const DEFAULTS: MockConfig = {
  scenario: 'default',
  latency: 'fast',
  orderResolutionMs: 2500,
}

function isScenario(v: unknown): v is ScenarioId {
  return typeof v === 'string' && v in SCENARIOS
}
function isLatency(v: unknown): v is LatencyId {
  return typeof v === 'string' && v in LATENCIES
}

function load(): MockConfig {
  let stored: Partial<MockConfig> = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    stored = {}
  }
  const params = new URLSearchParams(location.search)
  const scenario = params.get('scenario') ?? stored.scenario
  const latency = params.get('latency') ?? stored.latency
  const resolution = Number(params.get('orderResolutionMs') ?? stored.orderResolutionMs)
  return {
    scenario: isScenario(scenario) ? scenario : DEFAULTS.scenario,
    latency: isLatency(latency) ? latency : DEFAULTS.latency,
    orderResolutionMs: Number.isFinite(resolution) && resolution >= 0 ? resolution : DEFAULTS.orderResolutionMs,
  }
}

let config: MockConfig = DEFAULTS

export function initConfig() {
  config = load()
  persist()
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* storage unavailable — keep in memory */
  }
}

export function getConfig(): MockConfig {
  return config
}

export function setConfig(patch: Partial<MockConfig>) {
  config = {
    scenario: isScenario(patch.scenario) ? patch.scenario : config.scenario,
    latency: isLatency(patch.latency) ? patch.latency : config.latency,
    orderResolutionMs: patch.orderResolutionMs ?? config.orderResolutionMs,
  }
  counters.clear()
  persist()
}

export function resetConfig() {
  config = { ...DEFAULTS }
  counters.clear()
  persist()
}

export function isScenarioActive(id: ScenarioId) {
  return config.scenario === id
}

/** Per-key request counters (used by "first attempt fails" scenarios). */
const counters = new Map<string, number>()
export function nextCount(key: string): number {
  const n = (counters.get(key) ?? 0) + 1
  counters.set(key, n)
  return n
}

let requestSeq = 0

/** Deterministic latency for the current request. */
export function latencyFor(kind: 'catalog' | 'default'): number {
  requestSeq += 1
  if (config.scenario === 'out-of-order' && kind === 'catalog') {
    // Alternate slow/fast so that an earlier request resolves after a later one.
    return requestSeq % 2 === 1 ? 1800 : 250
  }
  switch (config.latency) {
    case 'none':
      return 0
    case 'fast':
      return 150 + ((requestSeq * 37) % 150)
    case 'slow':
      return 2500
    case 'variable':
      return 100 + ((requestSeq * 7919) % 1700)
  }
}
