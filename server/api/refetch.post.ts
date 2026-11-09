import { OFFICIAL_SOURCES, refetchOfficial } from '../scrape/official'

/**
 * 手动刷新官方套餐源：
 *   POST /api/refetch          走 24h 缓存
 *   POST /api/refetch?force=1  强制重抓官方页面
 * 外部 cron 也可每日调一次（结果幂等）。
 */
export default defineEventHandler(async (event) => {
  const force = getQuery(event).force === '1'
  const summary = await refetchOfficial(force)
  return {
    ...summary,
    sources: OFFICIAL_SOURCES.map(c => ({
      slug: c.slug,
      url: c.url,
      status: summary.ok.includes(c.slug) ? 'ok' : 'fail'
    }))
  }
})
