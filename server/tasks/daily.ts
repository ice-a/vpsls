import { runCheck } from '../utils/scheduler'
import { refetchOfficial } from '../scrape/official'
import { warmupRates } from '../utils/rates'
import { sqliteStats } from '../utils/sqlite'

/**
 * 每日任务聚合：检测 → 官方套餐抓取 → 汇率刷新
 * 给外部 cron（服务器 crontab / host cron）调用 POST /api/cron。
 * 每步独立 try/catch，任一失败不阻断其余步骤。
 */
export interface CronResult {
  checkedAt: string
  check: { up: number; down: number; total: number } | null
  refetch: { ok: string[]; fail: string[]; totalPlans: number } | null
  rates: { usdCny: number; source: string } | null
  storage: { backend: 'sqlite'; rows: number }
  errors: string[]
}

export async function runDailyJob(): Promise<CronResult> {
  const errors: string[] = []
  const out: CronResult = {
    checkedAt: new Date().toISOString(),
    check: null,
    refetch: null,
    rates: null,
    storage: { backend: 'sqlite', rows: sqliteStats().rows },
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

  out.storage.rows = sqliteStats().rows
  return out
}