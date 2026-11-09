import { getOffers, getOfficialMeta, getProviderRows, getState } from '../utils/db'
import type { HomeStats, Offer, ProviderRow } from '#shared/types'

/**
 * 首页聚合接口：统计 + 最便宜榜 + 推荐位 + 厂商摘要
 * 服务端直接调用同进程函数 —— 前后端不分离的「后端」就是这些 route。
 */
export default defineEventHandler(() => {
  const offers = getOffers()
  const rows = getProviderRows()
  const { lastRun } = getState()

  const stats: HomeStats = {
    offerCount: offers.length,
    providerCount: rows.length,
    regionCount: new Set(offers.flatMap(o => o.regions)).size,
    updatedAt: lastRun?.finishedAt ?? new Date().toISOString(),
    upCount: rows.filter(r => r.availability === 'up').length,
    downCount: rows.filter(r => r.availability === 'down').length
  }

  const official = getOfficialMeta()
  const officialCount = offers.filter(o => o.source === 'official').length

  const recommendCmp = (a: Offer, b: Offer) =>
    Number(b.hasAff) - Number(a.hasAff) ||
    Number(b.cycle === 'yearly') - Number(a.cycle === 'yearly') ||
    a.perYear - b.perYear
  const cheapest: Offer[] = [...offers]
    .filter(o => o.cycle === 'yearly')
    .sort(recommendCmp)
    .slice(0, 8)
  const featured: Offer[] = offers.filter(o => o.featured).sort(recommendCmp)

  // 厂商摘要只给首页卡片需要的字段，避免首屏 payload 过大；有 aff 的排前
  const providers: Array<Pick<ProviderRow, 'slug' | 'name' | 'tagline' | 'availability' | 'offerCount' | 'cheapestPerMonth' | 'cheapestPerYear' | 'hasAff' | 'regions'>> =
    rows
      .slice()
      .sort((a, b) => Number(b.hasAff) - Number(a.hasAff) || b.offerCount - a.offerCount)
      .map(r => ({
        slug: r.slug, name: r.name, tagline: r.tagline,
        availability: r.availability, offerCount: r.offerCount,
        cheapestPerMonth: r.cheapestPerMonth, cheapestPerYear: r.cheapestPerYear,
        hasAff: r.hasAff, regions: r.regions
      }))

  return { stats, cheapest, featured, providers, lastRun, official: { ...official, offerCount: officialCount } }
})
