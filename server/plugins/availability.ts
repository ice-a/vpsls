import { startDailyChecks } from '../utils/scheduler'

/**
 * Nitro 服务端插件：进程启动即注册每日可用性检测。
 * 仅在常驻 Node 环境（自有服务器 / 本地）有效。
 *
 * Cloudflare Workers 无进程内定时器 —— 那边由 Cron Triggers 或
 * GitHub Actions 调 POST /api/cron 触发，见 DEPLOY.md。
 */
export default defineNitroPlugin(() => {
  const isCF =
    typeof globalThis !== 'undefined' &&
    !!(globalThis as any).navigator?.userAgent?.includes('Cloudflare-Workers')

  if (isCF) {
    console.log('[check] Cloudflare 运行时：跳过进程内定时器，请用 /api/cron + Cron Triggers')
    return
  }

  startDailyChecks()
})