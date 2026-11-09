import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 存储抽象层：同一套接口，多种后端。
 *
 * 当前后端：SQLite（server/utils/sqlite.ts，Node 内置 node:sqlite）
 * 兜底后端：本地 JSON 文件（node:sqlite 不可用时的降级）
 *
 * SQLite 是同步 API，启动时同步安装完成，
 * 不存在「异步后端就绪前误写」的竞态问题。
 */

export interface StorageBackend {
  read(key: string): string | null
  write(key: string, content: string): void
}

const DATA_DIR = join(process.cwd(), '.data')

/** Node 文件后端（降级用） */
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

export function setStorageBackend(b: StorageBackend) {
  backend = b
}

export function storageRead(key: string): string | null {
  return backend.read(key)
}

export function storageWrite(key: string, content: string) {
  backend.write(key, content)
}