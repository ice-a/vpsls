import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { StorageBackend } from './storage'
import { setStorageBackend } from './storage'

/**
 * SQLite 后端（Node 内置 node:sqlite，零依赖）
 *
 * 为什么用 node:sqlite 而不是 better-sqlite3：
 *   - Node 22.5+ 内置，不需要编译原生模块，Docker 镜像不用装 build-essential/python
 *   - 体积 0 依赖，1核1G 机型友好
 *   - 同步 API，正好匹配现有同步业务代码（不用改调用方）
 *
 * 表结构：documents(key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)
 * 一个 key 一条记录，整份 JSON 存 data 字段 —— 与文件后端语义完全一致。
 */

const DB_PATH = process.env.SQLITE_PATH || join(process.cwd(), '.data', 'vpsls.db')

let db: DatabaseSync | null = null

function getDb(): DatabaseSync {
  if (db) return db
  mkdirSync(dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  // WAL 模式：读写不互斥，1核机上并发请求不会互相阻塞
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -2000;
    CREATE TABLE IF NOT EXISTS documents (
      key        TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  return db
}

/** 安装 SQLite 后端（同步，启动即用，无异步预热问题） */
export function installSqliteBackend(): boolean {
  try {
    const d = getDb()
    // 探针：确认库可写
    d.prepare(`INSERT INTO documents(key,data) VALUES('_probe','1')
               ON CONFLICT(key) DO UPDATE SET data='1'`).run()
    d.prepare(`DELETE FROM documents WHERE key='_probe'`).run()

    const backend: StorageBackend = {
      read(key) {
        try {
          const row = getDb().prepare('SELECT data FROM documents WHERE key=?').get(key) as
            | { data: string }
            | undefined
          return row?.data ?? null
        } catch (e) {
          console.error(`[sqlite] read ${key}: ${(e as Error).message}`)
          return null
        }
      },
      write(key, content) {
        try {
          getDb()
            .prepare(
              `INSERT INTO documents(key,data,updated_at) VALUES(?,?,datetime('now'))
               ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`
            )
            .run(key, content)
        } catch (e) {
          console.error(`[sqlite] write ${key}: ${(e as Error).message}`)
        }
      }
    }
    setStorageBackend(backend)
    console.log(`[sqlite] backend ready: ${DB_PATH}`)
    return true
  } catch (e) {
    console.error(`[sqlite] init failed: ${(e as Error).message}`)
    return false
  }
}

/** 统计信息（健康检查用） */
export function sqliteStats() {
  try {
    const d = getDb()
    const cnt = d.prepare('SELECT COUNT(*) AS n FROM documents').get() as { n: number }
    return { path: DB_PATH, rows: cnt.n }
  } catch {
    return { path: DB_PATH, rows: -1 }
  }
}