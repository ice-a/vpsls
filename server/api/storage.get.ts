import { flushMongo, mongoReady } from '../utils/mongodb'

/**
 * 存储健康检查：GET /api/storage
 * 给线上验收用 —— 一眼看出当前跑在 Mongo 还是本地文件，内存里有哪些 key。
 */
export default defineEventHandler(() => {
  const usingMongo = !!process.env.MONGODB_URI
  return {
    backend: usingMongo ? 'mongodb' : 'filesystem',
    db: process.env.MONGODB_DB || 'vpsls',
    mongoReady: mongoReady(),
    // 不返回连接串，只返回是否存在
    hasUri: usingMongo
  }
})