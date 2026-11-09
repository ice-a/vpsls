import { storageRead, storageWrite } from './storage'

/**
 * 访问统计（每日）：页面打开次数 / 出口点击（按产品） / 搜索条件。
 * 落 state 同级的 analytics.json。Node → 文件；Workers → KV。
 * 量级说明：整份 JSON 读写，日均几千 PV 内无压力；
 * 上量后把 record* 换成 D1/ClickHouse 即可，接口不用动。
 */

interface DayBucket { [key: string]: number }
interface DaySearch { count: number; conditions: DayBucket }

export interface AnalyticsState {
  /** pages[日期][路径] = 打开次数 */
  pages: Record<string, DayBucket>
  /** clicks[日期][offerId 或 provider:slug] = 点击次数 */
  clicks: Record<string, DayBucket>
  /** searches[日期] = { count: 总搜索次数, conditions: 归一化条件串 → 次数 } */
  searches: Record<string, DaySearch>
}

const EMPTY: AnalyticsState = { pages: {}, clicks: {}, searches: {} }
const KEY = 'analytics.json'
let cache: AnalyticsState | null = null

function load(): AnalyticsState {
  if (cache) return cache
  const raw = storageRead(KEY)
  if (raw) {
    try {
      cache = { ...EMPTY, ...JSON.parse(raw) }
    } catch {
      cache = structuredClone(EMPTY)
    }
  } else {
    cache = structuredClone(EMPTY)
  }
  return cache
}

function persist() {
  if (!cache) return
  storageWrite(KEY, JSON.stringify(cache))
}

/** 本地时区日期键 YYYY-MM-DD（统计按自然日切） */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function recordPageView(path: string) {
  const s = load()
  const day = dayKey()
  ;(s.pages[day] ??= {})[path] = ((s.pages[day]?.[path]) ?? 0) + 1
  persist()
}

/** offerId 有值记产品级，否则记 provider:slug（厂商级兜底） */
export function recordClick(key: string) {
  const s = load()
  const day = dayKey()
  ;(s.clicks[day] ??= {})[key] = ((s.clicks[day]?.[key]) ?? 0) + 1
  persist()
}

/** 条件归一化：k=v 按 key 排序拼接，空条件不计 */
export function normalizeConditions(conditions: Record<string, string | number | null | undefined>): string {
  const parts = Object.entries(conditions)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined && String(v).length > 0)
    .map(([k, v]) => [k, String(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
  return parts.join('&')
}

export function recordSearch(condStr: string) {
  if (!condStr) return
  const s = load()
  const day = dayKey()
  const bucket = (s.searches[day] ??= { count: 0, conditions: {} })
  bucket.count += 1
  bucket.conditions[condStr] = (bucket.conditions[condStr] ?? 0) + 1
  persist()
}

export interface StatsWindow {
  days: string[]
  daily: Array<{ date: string; views: number; clicks: number; searches: number }>
  topPages: Array<{ path: string; count: number }>
  topClicks: Array<{ key: string; count: number }>
  topSearches: Array<{ condition: string; count: number }>
  totals: { views: number; clicks: number; searches: number }
}

/** 最近 N 天聚合（含空天补零，方便画趋势） */
export function getStats(days = 14): StatsWindow {
  const s = load()
  const list: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    list.push(dayKey(new Date(Date.now() - i * 86400_000)))
  }

  const daily = list.map(date => ({
    date,
    views: Object.values(s.pages[date] ?? {}).reduce((a, b) => a + b, 0),
    clicks: Object.values(s.clicks[date] ?? {}).reduce((a, b) => a + b, 0),
    searches: s.searches[date]?.count ?? 0
  }))

  const agg = (m: Record<string, DayBucket | undefined>) => {
    const out: DayBucket = {}
    for (const d of list) {
      for (const [k, v] of Object.entries(m[d] ?? {})) out[k] = (out[k] ?? 0) + v
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1])
  }

  const searchAgg: DayBucket = {}
  for (const d of list) {
    for (const [k, v] of Object.entries(s.searches[d]?.conditions ?? {})) {
      searchAgg[k] = (searchAgg[k] ?? 0) + v
    }
  }

  return {
    days: list,
    daily,
    topPages: agg(s.pages).slice(0, 20).map(([path, count]) => ({ path, count })),
    topClicks: agg(s.clicks).slice(0, 30).map(([key, count]) => ({ key, count })),
    topSearches: Object.entries(searchAgg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([condition, count]) => ({ condition, count })),
    totals: {
      views: daily.reduce((a, d) => a + d.views, 0),
      clicks: daily.reduce((a, d) => a + d.clicks, 0),
      searches: daily.reduce((a, d) => a + d.searches, 0)
    }
  }
}