/**
 * Cloudflare Workers 入口（scheduled cron handler）
 *
 * Cloudflare Pages 的 _worker.js 由 Nitro 生成，直接改写不现实。
 * 这里用「外部 cron 打接口」的方案落地每日任务：
 * wrangler.toml 的 [triggers] crons 会在 04:00 触发 Worker，
 * 但 Pages 项目的 worker 没有 scheduled 导出 —— 因此实际执行走 HTTP 接口。
 *
 * 本文件提供的是给 Workers Cron 用的轻量 endpoint 语义说明与本地可复用的 runner，
 * 线上请用 GitHub Actions 或 Cloudflare Cron 调用：
 *   POST /api/cron  （见 server/api/cron.post.ts）
 */

import { runCheck } from '../utils/scheduler'
import { refetchOfficial } from '../scrape/official'
import { warmupRates } from '../utils/rates'

export interface CronResult {
  checkedAt: string
  check: { up: number; down: number; total: number } | null
  refetch: { ok: string[]; fail: string[]; totalPlans: number } | null
  rates: { usdCny: number; source: string } | null
  errors: string[]
}

/**
 * 一次性把每日任务跑完：可用性检测 → 官方套餐抓取 → 汇率刷新。
 * 每步独立 try/catch，任一失败不阻断其余步骤。
 */
export async function runDailyJob(): Promise<CronResult> {
  const errors: string[] = []
  const out: CronResult = {
    checkedAt: new Date().toISOString(),
    check: null,
    refetch: null,
    rates: null,
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

  return out
}