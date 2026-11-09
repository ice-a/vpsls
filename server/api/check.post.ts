import { runCheck } from '../utils/scheduler'

/**
 * 手动触发一轮可用性检测（也可给外部 cron 调）
 * curl -X POST http://localhost:3000/api/check
 */
export default defineEventHandler(async () => {
  const run = await runCheck()
  return { ok: true, run }
})
