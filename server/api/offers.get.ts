import { getOffers, getProviders } from '../utils/db'
import type { Offer } from '#shared/types'

/**
 * 实时筛选接口（对齐参考站「VPS 实时筛选器」）
 *
 * GET /api/offers?maxPrice=&minRam=&minCpu=&minDisk=&minBw=&region=&os=&cycle=&provider=&q=&sort=&window=
 *  - window: 预算窗口·年付总价上限（180/360/600/1200/2400；旧月单价值 ≤200 自动 ×12 兼容）；等价于 maxYear
 *  - maxPrice: 月单价上限；maxYear: 年付总价上限
 *  - sort: recommend|perYear|perMonth|price|ram|cpu|disk|bw （默认 recommend）
 *  - 全部可选；无参 = 默认推荐序（aff → 年付 → 年付总价）
 */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  // 旧链接 window=15/30/50/100/200 是月单价口径（≤200），×12 折成年付；其余值视为年付总价原值直接使用
  const legacyWindow = [15, 30, 50, 100, 200]
  const normYear = (v: number | undefined): number | undefined =>
    v === undefined ? undefined : legacyWindow.includes(v) ? v * 12 : v
  const maxPrice = num(q.maxPrice)
  const maxYear = normYear(num(q.maxYear)) ?? normYear(num(q.window))
  const minRam = num(q.minRam)
  const minCpu = num(q.minCpu)
  const minDisk = num(q.minDisk)
  const minBw = num(q.minBw)
  const region = typeof q.region === 'string' && q.region ? q.region : undefined
  const os = typeof q.os === 'string' && q.os ? q.os : undefined
  const cycle = typeof q.cycle === 'string' && q.cycle ? q.cycle : undefined
  const provider = typeof q.provider === 'string' && q.provider ? q.provider : undefined
  const kw = typeof q.q === 'string' ? q.q.trim().toLowerCase() : undefined
  const sort = typeof q.sort === 'string' && q.sort ? q.sort : 'recommend'

  let list: Offer[] = getOffers()

  if (maxPrice !== undefined) list = list.filter(o => o.perMonth <= maxPrice)
  if (maxYear !== undefined) list = list.filter(o => o.perYear <= maxYear)
  if (minRam !== undefined) list = list.filter(o => o.ram >= minRam)
  if (minCpu !== undefined) list = list.filter(o => o.cpu >= minCpu)
  if (minDisk !== undefined) list = list.filter(o => o.disk >= minDisk)
  if (minBw !== undefined) list = list.filter(o => o.bandwidth >= minBw)
  if (region) list = list.filter(o => o.regions.includes(region))
  if (os) list = list.filter(o => o.os === os)
  if (cycle) list = list.filter(o => o.cycle === cycle)
  if (provider) list = list.filter(o => o.providerSlug === provider)
  if (kw) {
    list = list.filter(o => {
      const name = getProviders().find(p => p.slug === o.providerSlug)?.name.toLowerCase() ?? ''
      return o.title.toLowerCase().includes(kw) || name.includes(kw) || o.tags.some(t => t.toLowerCase().includes(kw))
    })
  }

  const cmp: Record<string, (a: Offer, b: Offer) => number> = {
    // 推荐序（默认）：有 aff 优先 → 年付优先 → 年付总价升序
    recommend: (a, b) =>
      Number(b.hasAff) - Number(a.hasAff) ||
      Number(b.cycle === 'yearly') - Number(a.cycle === 'yearly') ||
      a.perYear - b.perYear,
    perMonth: (a, b) => a.perMonth - b.perMonth,
    perYear: (a, b) => a.perYear - b.perYear,
    price: (a, b) => a.price - b.price,
    ram: (a, b) => b.ram - a.ram,
    cpu: (a, b) => b.cpu - a.cpu,
    disk: (a, b) => b.disk - a.disk,
    bw: (a, b) => b.bandwidth - a.bandwidth
  }
  list = [...list].sort(cmp[sort] ?? cmp.recommend)

  return { total: list.length, offers: list }
})
