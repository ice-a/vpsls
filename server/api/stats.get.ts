import { getStats } from '../utils/analytics'

/** 统计聚合：GET /api/stats?days=14 */
export default defineEventHandler((event) => {
  const days = Number(getQuery(event).days) || 14
  return getStats(Math.min(Math.max(days, 1), 90))
})
