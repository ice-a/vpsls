import { storageRead, storageWrite } from './storage'

/**
 * 实时汇率（USD → CNY）
 *  - 双源：jsdelivr currency-api（主）→ open.er-api.com（备）→ 回退常量
 *  - 缓存 rates.json，6 小时内直接用缓存；过期则后台刷新（本次请求先用旧值，不阻塞页面）
 *  - 对外接口 GET /api/rates
 */

interface RatesState {
  usdCny: number
  updatedAt: string
  source: string
  fallback: boolean
}

const TTL_MS = 6 * 3600 * 1000
const FALLBACK: RatesState = { usdCny: 6.68, updatedAt: '1970-01-01T00:00:00.000Z', source: 'fallback', fallback: true }
const KEY = 'rates.json'

let cache: RatesState | null = null
let refreshing: Promise<RatesState> | null = null

function loadCache(): RatesState {
  if (cache) return cache
  const raw = storageRead(KEY)
  if (raw) {
    try {
      cache = { ...FALLBACK, ...JSON.parse(raw) }
    } catch {
      cache = { ...FALLBACK }
    }
  } else {
    cache = { ...FALLBACK }
  }
  return cache
}

function saveCache(s: RatesState) {
  cache = s
  storageWrite(KEY, JSON.stringify(s, null, 2))
}

async function fetchFrom(url: string, pick: (j: any) => number | undefined): Promise<number | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' } })
    if (!res.ok) return undefined
    const v = pick(await res.json())
    return typeof v === 'number' && Number.isFinite(v) && v > 1 && v < 100 ? v : undefined
  } catch {
    return undefined
  }
}

/** 拉一次汇率（双源兜底），成功落盘 */
async function refresh(): Promise<RatesState> {
  const usdCny =
    (await fetchFrom(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      j => j?.usd?.cny
    )) ??
    (await fetchFrom('https://open.er-api.com/v6/latest/USD', j => j?.rates?.CNY))

  if (usdCny) {
    const next: RatesState = { usdCny, updatedAt: new Date().toISOString(), source: 'live', fallback: false }
    saveCache(next)
    return next
  }
  // 双源全挂：保留旧值，仅标记时间不动
  return loadCache()
}

/** 取当前汇率：新鲜直接用，过期触发后台刷新并返回旧值 */
export async function getRates(): Promise<RatesState> {
  const cur = loadCache()
  const fresh = Date.now() - new Date(cur.updatedAt).getTime() < TTL_MS
  if (fresh) return cur

  if (!refreshing) {
    refreshing = refresh()
      .catch(() => loadCache())
      .finally(() => {
        refreshing = null
      })
  }
  // 不阻塞调用方：先给旧值/回退值，后台更新
  refreshing.catch(() => {})
  return cur
}

/** 强制刷新（首次启动或手动），用于种子 */
export async function warmupRates(): Promise<RatesState> {
  return refresh().catch(() => loadCache())
}