import { startDailyChecks } from '../utils/scheduler'

/**
 * Nitro 服务端插件：进程启动即注册每日可用性检测。
 * dev 热重载、生产 start 都会走这里，幂等。
 */
export default defineNitroPlugin(() => {
  startDailyChecks()
})
