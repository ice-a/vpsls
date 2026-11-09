import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 存储抽象层：同一套接口，多种后端。
 *  - Node（本地 / VPS）：落 .data/ 下的 JSON 文件
 *  - MongoDB（Atlas 等）：server/utils/mongodb.ts 挂载
 *
 * 约定：所有读写都是「整份 JSON 读取 + 整份 JSON 写回」，
 * 键名形如 'state.json'、'official/plans.json'，Node 下直接映射为路径。
 *
 * 重要：Mongo 后端是异步初始化的。在它就绪之前如果直接写 fs，
 * 线上（Workers 无磁盘）会抛错、本地也会把数据写到不该写的磁盘上。
 * 因此这里加 pending 缓冲：设置 MONGODB_URI 时，初始化完成前的写操作
 * 先暂存，待后端切换后自动回放。
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

/** 内存后端：用于「等待远端后端就绪」的过渡期，绝不碰磁盘 */
function memoryBackend(): StorageBackend & { dump(): Map<string, string> } {
  const store = new Map<string, string>()
  return {
    read: key => store.get(key) ?? null,
    write: (key, content) => {
      store.set(key, content)
    },
    dump: () => store
  }
}

let backend: StorageBackend = fsBackend
/** Mongo 初始化期间用的缓冲；切换时把内容回放到新后端 */
let pending: (StorageBackend & { dump(): Map<string, string> }) | null = null

/**
 * 挂载远端后端。
 * - 有 MONGODB_URI：先切到内存缓冲，初始化成功后再把缓冲内容回放给 Mongo
 * - 无 MONGODB_URI：直接用 fs
 */
export function beginRemoteTransition() {
  pending = memoryBackend()
  backend = pending
}

export function setStorageBackend(b: StorageBackend) {
  // 把过渡期缓冲的写入回放到真正的后端
  if (pending) {
    const replay = pending.dump()
    pending = null
    backend = b
    for (const [key, content] of replay) {
      try {
        b.write(key, content)
      } catch (e) {
        console.error(`[storage] replay ${key} failed: ${(e as Error).message}`)
      }
    }
    return
  }
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