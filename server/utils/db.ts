import type { CheckRun, Offer, Provider, ProviderRow } from '#shared/types'
import { hasAffProvider } from '#shared/aff'
import { SEED_PROVIDERS } from '../data/providers'
import { buildOffers } from '../data/offers'
import { getOfficialState } from '../scrape/official'
import { perMonthOf } from '../scrape/parsers'
import { storageRead, storageWrite } from './storage'

/**
 * 轻量 JSON 存储（单体站够用）：
 *  - 目录数据（厂商/套餐）来自种子文件，代码即数据；
 *  - 运行状态（可用性检测结果、最近一次检测汇总）持久化到 state.json。
 *
 * 存储后端由 storage.ts 决定：Node → .data/ 文件；Workers → KV。
 */

export interface PersistedState {
  providerStatus: Record<string, Pick<Provider, 'availability' | 'lastCheckedAt' | 'failStreak'>>
  lastRun: CheckRun | null
}

const EMPTY: PersistedState = { providerStatus: {}, lastRun: null }
const STATE_KEY = 'state.json'

let cache: PersistedState | null = null

function load(): PersistedState {
  if (cache) return cache
  const raw = storageRead(STATE_KEY)
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
  storageWrite(STATE_KEY, JSON.stringify(cache, null, 2))
}

/** 种子目录 + 状态合并后的厂商列表 */
export function getProviders(): Provider[] {
  const state = load()
  return SEED_PROVIDERS.map(p => ({ ...p, ...(state.providerStatus[p.slug] ?? {}) }))
}

export function getProvider(slug: string): Provider | undefined {
  return getProviders().find(p => p.slug === slug)
}

/** 年付总价：月付×12 / 季付×4 / 半年付×2 / 年付=标价（不走 perMonth×12 防舍入漂移） */
const YEAR_DIV: Record<string, number> = { monthly: 12, quarterly: 4, semiannual: 2, yearly: 1 }
export const perYearOf = (price: number, cycle: string) =>
  Math.round(price * (YEAR_DIV[cycle] ?? 12) * 100) / 100

/** 套餐：官方抓取成功的厂商整组替换种子，其余回退种子（source 标记数据口径） */
export function getOffers(): Offer[] {
  const official = getOfficialState()
  const seed = buildOffers().map(o => ({
    ...o,
    source: 'seed' as const,
    perYear: perYearOf(o.price, o.cycle),
    hasAff: hasAffProvider(o.providerSlug, o.url)
  }))
  const withOfficial = seed.filter(o => !(official.bySlug[o.providerSlug]?.plans.length))

  const extra: Offer[] = []
  for (const [slug, entry] of Object.entries(official.bySlug)) {
    entry.plans.forEach((p, i) => {
      const perMonth = perMonthOf(p.price, p.cycle)
      extra.push({
        id: `of_${slug}_${i.toString().padStart(3, '0')}`,
        providerSlug: slug,
        title: p.name,
        cpu: p.cpu ?? 1,
        ram: p.ram ?? 1,
        disk: p.disk ?? 20,
        diskType: p.diskType ?? 'SSD',
        bandwidth: p.bandwidth ?? 1000,
        traffic: p.traffic ?? '—',
        regions: p.regions.length ? p.regions : ['EU'],
        price: p.price,
        cycle: p.cycle,
        perMonth,
        perYear: perYearOf(p.price, p.cycle),
        hasAff: hasAffProvider(slug, p.url),
        os: 'linux',
        tags: ['官方实时'],
        url: p.url,
        source: 'official'
      })
    })
  }
  return [...withOfficial, ...extra]
}

/** 官方抓取状态（给统计/页脚展示口径） */
export function getOfficialMeta() {
  const s = getOfficialState()
  return {
    updatedAt: s.updatedAt,
    slugs: Object.keys(s.bySlug),
    counts: Object.fromEntries(Object.entries(s.bySlug).map(([k, v]) => [k, v.count]))
  }
}

/** 厂商聚合行：套餐数 + 最低月付/年付 + 是否有 aff，供厂商表使用 */
export function getProviderRows(): ProviderRow[] {
  const offers = getOffers()
  return getProviders().map(p => {
    const mine = offers.filter(o => o.providerSlug === p.slug)
    const months = mine.map(o => o.perMonth)
    const years = mine.map(o => o.perYear)
    return {
      ...p,
      offerCount: mine.length,
      cheapestPerMonth: months.length ? Math.min(...months) : null,
      cheapestPerYear: years.length ? Math.min(...years) : null,
      hasAff: mine.length ? mine.some(o => o.hasAff) : hasAffProvider(p.slug, p.url)
    }
  })
}

export function getState(): PersistedState {
  return load()
}

/** 由 scheduler 写入单个厂商状态 */
export function setProviderStatus(
  slug: string,
  patch: Pick<Provider, 'availability' | 'lastCheckedAt' | 'failStreak'>
) {
  const state = load()
  state.providerStatus[slug] = patch
  persist()
}

/** 由 scheduler 写入最近一次检测汇总 */
export function setLastRun(run: CheckRun) {
  const state = load()
  state.lastRun = run
  persist()
}