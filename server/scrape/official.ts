import { storageRead, storageWrite } from '../utils/storage'
import { fetchPage } from './fetch'
import { parseOvh, parseWapac, parseWhmcsNew, parseWhmcsOld, type ScrapedPlan } from './parsers'

/**
 * 官方源调度：抓取 → 按厂商选解析器 → 落 official/plans.json。
 *  - 成功的厂商：套餐目录整体换成官方（source=official）
 *  - 失败/反爬/客户端渲染的厂商：无 plans 条目 → 回退种子（source=seed）
 *  - HTML 24h 缓存在 fetch.ts；plans.json 每次 refetch 全量重写
 *  - Node → .data/official/；Workers → KV
 */

export interface SourceCfg {
  slug: string
  url: string
  kind: 'whmcs-old' | 'whmcs-new' | 'wapac' | 'ovh'
  defaultRegions: string[]
}

/** 已解剖验证过的 6 个官方源 */
export const OFFICIAL_SOURCES: SourceCfg[] = [
  { slug: 'bandwagon', url: 'https://bwh81.net/cart.php?gid=1', kind: 'whmcs-old', defaultRegions: ['US-WEST'] },
  { slug: 'colocrossing', url: 'https://cloud.colocrossing.com/cart.php?gid=1', kind: 'whmcs-new', defaultRegions: ['US-EAST'] },
  { slug: 'bytevirt', url: 'https://bytevirt.com/store/', kind: 'whmcs-new', defaultRegions: ['US-WEST'] },
  { slug: 'dedione', url: 'https://dedione.com/store/', kind: 'whmcs-new', defaultRegions: ['US-EAST'] },
  { slug: 'wapac', url: 'https://wap.ac/store/', kind: 'wapac', defaultRegions: ['ASIA'] },
  { slug: 'ovhcloud', url: 'https://www.ovhcloud.com/en/vps/', kind: 'ovh', defaultRegions: ['EU'] }
]

const PLANS_KEY = 'official/plans.json'

export interface PlansState {
  updatedAt: string
  /** slug → 当日抓取结果；解析 0 条 = 抓取失败，该厂商回退种子 */
  bySlug: Record<string, { at: string; count: number; url: string; plans: ScrapedPlan[] }>
}

let cache: PlansState | null = null

function load(): PlansState {
  if (cache) return cache
  const raw = storageRead(PLANS_KEY)
  if (raw) {
    try {
      cache = JSON.parse(raw)
    } catch {
      cache = { updatedAt: '', bySlug: {} }
    }
  } else {
    cache = { updatedAt: '', bySlug: {} }
  }
  return cache
}

function persist() {
  if (!cache) return
  storageWrite(PLANS_KEY, JSON.stringify(cache))
}

function parseBy(kind: SourceCfg['kind'], html: string, cfg: SourceCfg): ScrapedPlan[] {
  switch (kind) {
    case 'whmcs-old':
      return parseWhmcsOld(html, cfg.url.replace(/cart\.php.*$/, '').replace(/\/$/, ''), cfg.defaultRegions)
    case 'whmcs-new':
      return parseWhmcsNew(html, cfg.url, cfg.defaultRegions)
    case 'wapac':
      return parseWapac(html, cfg.url, cfg.defaultRegions)
    case 'ovh':
      return parseOvh(html, cfg.url, cfg.defaultRegions)
  }
}

export interface RefetchSummary {
  ok: string[]
  fail: string[]
  totalPlans: number
  durationMs: number
}

/** 抓一轮全部官方源（并发 3）；force 忽略 24h 缓存强制重抓 */
export async function refetchOfficial(force = false): Promise<RefetchSummary> {
  const t0 = Date.now()
  const state = load()
  const queue = [...OFFICIAL_SOURCES]
  const ok: string[] = []
  const fail: string[] = []
  let totalPlans = 0

  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const cfg = queue.shift()!
        try {
          const page = await fetchPage(cfg.url, { force })
          const plans = page.ok ? parseBy(cfg.kind, page.body, cfg) : []
          if (plans.length) {
            state.bySlug[cfg.slug] = { at: new Date().toISOString(), count: plans.length, url: cfg.url, plans }
            ok.push(cfg.slug)
            totalPlans += plans.length
          } else {
            // 解析为空：清掉旧条目（防止过期官方价留用），回退种子
            delete state.bySlug[cfg.slug]
            fail.push(cfg.slug)
          }
        } catch {
          delete state.bySlug[cfg.slug]
          fail.push(cfg.slug)
        }
      }
    })
  )

  state.updatedAt = new Date().toISOString()
  cache = state
  persist()
  return { ok, fail, totalPlans, durationMs: Date.now() - t0 }
}

/** 取某厂商的官方套餐（无 = 该厂商回退种子） */
export function getOfficialPlans(slug: string): ScrapedPlan[] {
  return load().bySlug[slug]?.plans ?? []
}

export function getOfficialState(): PlansState {
  return load()
}

export function officialStale(): boolean {
  const s = load()
  if (!s.updatedAt) return true
  return Date.now() - new Date(s.updatedAt).getTime() > 24 * 3600 * 1000
}