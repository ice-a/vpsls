import { installSqliteBackend } from '../utils/sqlite'

/**
 * 启动挂载持久化后端。
 *
 * 现在只有一种：SQLite（node:sqlite 内置，零依赖）。
 * 1核1G 自建机 / Docker 场景都走这条，不依赖任何外部数据库。
 *
 * 保留 fs 后端作为兜底（node:sqlite 不可用的老版本 Node）。
 */
export default defineNitroPlugin(() => {
  const ok = installSqliteBackend()
  if (!ok) {
    console.error('[storage] SQLite 不可用，回退本地文件后端 (.data/)')
  }
})