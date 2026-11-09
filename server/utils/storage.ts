import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 存储抽象层：同一套接口，两种后端。
 *  - Node（本地 / VPS）：落 .data/ 下的 JSON 文件
 *  - Cloudflare Workers：走 KV（绑定名 DATA），key 同名
 *
 * 约定：所有读写都是「整份 JSON 读取 + 整份 JSON 写回」，
 * 键名形如 'state.json'、'official/plans.json'，Node 下直接映射为路径。
 *
 * Workers 上无法同步读 KV（KV API 是异步的），因此这里给 Node 保留同步实现，
 * Workers 侧走 useKV 挂载的异步版本（见 cloudflare-kv.ts）。
 */

export interface StorageBackend {
  read(key: string): string | null
  write(key: string, content: string): void
}

const DATA_DIR = join(process.cwd(), '.data')

/** Node 文件后端 */
export const fsBackend: StorageBackend = {
  read(key) {
    const p = join(DATA_DIR, key)
    if (!existsSync(p)) return null
    try {
      return readFileSync(p, 'utf-8')
    } catch {
      return null
    }
  },
  write(key, content) {
    const p = join(DATA_DIR, key)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content, 'utf-8')
  }
}

let backend: StorageBackend = fsBackend

/** Cloudflare Workers 启动时挂载 KV 后端 */
export function setStorageBackend(b: StorageBackend) {
  backend = b
}

export function storageRead(key: string): string | null {
  return backend.read(key)
}

export function storageWrite(key: string, content: string) {
  backend.write(key, content)
}

/** 判断当前是否在 Cloudflare 运行时 */
export const isCloudflare = () =>
  typeof globalThis !== 'undefined' &&
  !!(globalThis as any).navigator?.userAgent?.includes('Cloudflare-Workers')