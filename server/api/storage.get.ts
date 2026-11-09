import { sqliteStats } from '../utils/sqlite'

/** 存储健康检查：GET /api/storage —— 线上排查第一站 */
export default defineEventHandler(() => {
  const s = sqliteStats()
  return {
    backend: 'sqlite',
    path: s.path,
    rows: s.rows,
    driver: 'node:sqlite',
    node: process.version
  }
})