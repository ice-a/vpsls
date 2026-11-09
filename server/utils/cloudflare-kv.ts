import type { StorageBackend } from './storage'
import { setStorageBackend } from './storage'

/**
 * Cloudflare Workers KV 后端。
 *
 * 关键约束：KV 的 API 是异步的，而现有业务代码是同步读写（读取缓存 → 计算 → 写回）。
 * 直接改会造成全链路 async 化（5 个模块、十几个调用点），风险和收益不成正比。
 *
 * 采用「内存快照 + 异步回写」策略：
 *  - 首次访问某个 key：同步返回 null（当前请求先用种子/回退值）
 *  - 同时在后台拉 KV，拉到后回填内存
 *  - 写入：先更新内存（后续请求立即可见），再异步 put 到 KV
 *
 * 代价：冷启动后第一次请求可能读到空（用种子兜底），第二个请求起就是 KV 真值。
 * 对 SSR 展示站可接受——数据本身就是分钟级更新的。
 */

interface KVNamespaceLike {
  get(key: string, opts?: { type?: 'text' }): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

const mem = new Map<string, string>()
const loading = new Set<string>()
let bound: KVNamespaceLike | null = null

/** 把 KV 绑定进内存缓存（预热常用 key） */
export async function warmKV(kv: KVNamespaceLike, keys: string[]) {
  bound = kv
  await Promise.all(
    keys.map(async k => {
      try {
        const v = await kv.get(k)
        if (v !== null && !mem.has(k)) mem.set(k, v)
      } catch {
        /* 预热失败不影响启动 */
      }
    })
  )
}

/** Workers 启动时调用：注册 KV 后端 */
export function installKVBackend(kv: KVNamespaceLike) {
  bound = kv

  const backend: StorageBackend = {
    read(key) {
      const hit = mem.get(key)
      if (hit !== undefined) return hit
      // 未命中：后台异步拉，本次请求返回 null（上层用种子兜底）
      if (!loading.has(key)) {
        loading.add(key)
        kv.get(key)
          .then(v => {
            if (v !== null) mem.set(key, v)
          })
          .catch(() => {})
          .finally(() => loading.delete(key))
      }
      return null
    },
    write(key, content) {
      mem.set(key, content)
      // 异步回写，失败只影响下次冷启动后的首请求
      kv.put(key, content).catch(() => {})
    }
  }

  setStorageBackend(backend)
}

/** 供 cron handler 使用：把内存里的脏数据强制刷到 KV */
export async function flushKV(keys: string[]) {
  if (!bound) return
  await Promise.all(
    keys.map(k => {
      const v = mem.get(k)
      return v ? bound!.put(k, v).catch(() => {}) : Promise.resolve()
    })
  )
}

/** 调试用：当前内存里有哪些 key */
export const kvMemKeys = () => [...mem.keys()]