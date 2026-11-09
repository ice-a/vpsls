import { installKVBackend } from '../utils/cloudflare-kv'

/**
 * Cloudflare 运行时挂载 KV 后端。
 *
 * Workers 里 Nitro 把环境变量/绑定放在 event.context.cloudflare.env 或全局 __env__ 上。
 * 拿不到绑定时静默降级为内存后端（storage.ts 默认是 fs，Workers 上 fs 会抛，所以这里也兜底）。
 */
export default defineNitroPlugin(() => {
  const g = globalThis as any
  const kv = g.__env__?.DATA ?? g.process?.env?.DATA ?? g.caches?.DATA

  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    installKVBackend(kv)
    console.log('[storage] Cloudflare KV backend installed')
  }
})