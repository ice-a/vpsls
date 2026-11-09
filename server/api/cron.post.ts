import { runDailyJob } from '../tasks/daily'

/**
 * 每日任务统一入口（给 Cloudflare Cron / GitHub Actions / 任意外部调度器调用）
 *
 *   POST /api/cron
 *   POST /api/cron?key=YOUR_SECRET   （配置了 CRON_SECRET 环境变量时必须带）
 *
 * 依次执行：可用性检测 → 官方套餐抓取 → 汇率刷新。
 * 结果幂等，重复调用无副作用。
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = getQuery(event).key ?? getHeader(event, 'x-cron-key')
    if (provided !== secret) {
      throw createError({ statusCode: 401, statusMessage: 'invalid cron key' })
    }
  }

  const result = await runDailyJob()
  return { ok: result.errors.length === 0, ...result }
})