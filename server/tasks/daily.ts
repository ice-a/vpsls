import { runCheck } from '../utils/scheduler'
import { refetchOfficial } from '../scrape/official'
import { warmupRates } from '../utils/rates'
import { flushMongo } from '../utils/mongodb'

/**
 * 每日任务聚合：检测 → 官方套餐抓取 → 汇率刷新 → 刷盘
 * 给 Cloudflare Cron / GitHub Actions / 任意外部调度器调用。
 * 每步独立 try/catch，任一失败不阻断其余步骤。
 */
export interface CronResult {
  checkedAt: string
  check: { up: number; down: number; total: number } | null
  refetch: { ok: string[]; fail: string[]; totalPlans: number } | null
  rates: { usdCny: number; source: string } | null
  storage: 'mongodb' | 'filesystem'
  errors: string[]
}

export async function runDailyJob(): Promise<CronResult> {
  const errors: string[] = []
  const out: CronResult = {
    checkedAt: new Date().toISOString(),
    check: null,
    refetch: null,
    rates: null,
    storage: process.env.MONGODB_URI ? 'mongodb' : 'filesystem',
    errors
  }

  try {
    const run = await runCheck()
    out.check = { up: run.up, down: run.down, total: run.total }
  } catch (e) {
    errors.push(`check: ${(e as Error).message}`)
  }

  try {
    const s = await refetchOfficial()
    out.refetch = { ok: s.ok, fail: s.fail, totalPlans: s.totalPlans }
  } catch (e) {
    errors.push(`refetch: ${(e as Error).message}`)
  }

  try {
    const r = await warmupRates()
    out.rates = { usdCny: r.usdCny, source: r.source }
  } catch (e) {
    errors.push(`rates: ${(e as Error).message}`)
  }

  // 把内存里的脏数据一次性刷到 Mongo（保证 cron 跑完数据真落库）
  try {
    await flushMongo()
  } catch (e) {
    errors.push(`flush: ${(e as Error).message}`)
  }

  return out
}