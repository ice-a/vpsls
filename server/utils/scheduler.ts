import type { CheckRun, Provider } from '#shared/types'
import { getProviders, getState, setLastRun, setProviderStatus } from './db'
import { officialStale, refetchOfficial } from '../scrape/official'

/**
 * 每日可用性自动检测
 *
 *  - 每天 CHECK_HOUR（默认凌晨 4 点）跑一轮：逐个 GET 服务商官网首页，
 *    2xx/3xx/401/403 均视为「在线」（403 只是拦爬虫，服务本身活着）；
 *    单次超时 8s，失败重试 1 次。
 *  - 连续 3 轮全失败标 down，一旦成功立即回 up。
 *  - 启动时若距上次检测超过 20 小时，静默补跑一轮。
 *  - 手动触发：curl -X POST http://localhost:3000/api/check
 *
 * 多实例部署建议只留一个实例跑 startDailyChecks，或换成外部 cron 调
 * POST /api/check（检测结果幂等，多跑只是浪费请求）。
 */

const CHECK_HOUR = 4 // 本地时间凌晨 4 点
const TIMEOUT_MS = 8000
const RETRIES = 1
const FAIL_DOWN_AFTER = 3
const STALE_MS = 20 * 3600 * 1000
const CONCURRENCY = 6

async function probe(url: string): Promise<boolean> {
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'VPSStatusBot/1.0 (+daily availability check)' }
      })
      if (res.ok || res.status === 401 || res.status === 403) return true
    } catch {
      /* 网络层失败/超时 → 走重试 */
    }
  }
  return false
}

/** 跑一轮全量检测并落盘，返回汇总 */
export async function runCheck(): Promise<CheckRun> {
  const startedAt = new Date()
  const providers = getProviders()
  const queue = [...providers]
  const results = new Map<string, boolean>()

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const p = queue.shift()!
      results.set(p.slug, await probe(p.url))
    }
  })
  await Promise.all(workers)

  let up = 0
  let down = 0
  const now = new Date().toISOString()
  for (const p of providers) {
    const ok = results.get(p.slug) ?? null
    let availability: Provider['availability']
    let failStreak: number

    if (ok === null) {
      availability = p.availability
      failStreak = p.failStreak
    } else if (ok) {
      availability = 'up'
      failStreak = 0
    } else {
      failStreak = p.failStreak + 1
      availability = failStreak >= FAIL_DOWN_AFTER ? 'down' : 'up'
    }
    if (availability === 'up') up++
    else if (availability === 'down') down++

    setProviderStatus(p.slug, { availability, lastCheckedAt: now, failStreak })
  }

  const finishedAt = new Date()
  const run: CheckRun = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    total: providers.length,
    up,
    down,
    unknown: providers.length - up - down,
    durationMs: finishedAt.getTime() - startedAt.getTime()
  }
  setLastRun(run)
  return run
}

function msUntilNextCheck(): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(CHECK_HOUR, 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

let timer: ReturnType<typeof setTimeout> | null = null
let running = false

function loop() {
  timer = setTimeout(async () => {
    if (!running) return // startDailyChecks 已被停止
    try {
      const run = await runCheck()
      console.log(`[check] daily run: up=${run.up} down=${run.down} total=${run.total} (${run.durationMs}ms)`)
    } catch (err) {
      console.error('[check] daily run failed:', err)
    }
    // 顺带刷新官方套餐源（与检测同频：每日一轮）
    refetchOfficial()
      .then(s => console.log(`[scrape] daily refetch: ok=${s.ok.join(',') || '-'} fail=${s.fail.join(',') || '-'} plans=${s.totalPlans}`))
      .catch(err => console.error('[scrape] daily refetch failed:', err))
    loop()
  }, msUntilNextCheck())
}

/** 进程启动时调用一次（幂等）：补跑陈旧检测 + 注册每日定时器 */
export function startDailyChecks() {
  if (running) return
  running = true

  const last = getState().lastRun
  const stale = !last || Date.now() - new Date(last.finishedAt).getTime() > STALE_MS
  if (stale) {
    runCheck()
      .then(run => console.log(`[check] startup catch-up run: up=${run.up} down=${run.down} total=${run.total}`))
      .catch(err => console.error('[check] startup run failed:', err))
  }
  if (officialStale()) {
    refetchOfficial()
      .then(s => console.log(`[scrape] startup refetch: plans=${s.totalPlans} fail=${s.fail.join(',') || '-'}`))
      .catch(err => console.error('[scrape] startup refetch failed:', err))
  }

  loop()
  console.log(`[check] daily availability check scheduled at ${String(CHECK_HOUR).padStart(2, '0')}:00`)
}

/** 优雅停止（测试/热重载用） */
export function stopDailyChecks() {
  running = false
  if (timer) clearTimeout(timer)
  timer = null
}
