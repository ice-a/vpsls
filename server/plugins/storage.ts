import { beginRemoteTransition, setStorageBackend } from '../utils/storage'

/**
 * 启动挂载持久化后端（按优先级）：
 *   1. MONGODB_URI 存在 → MongoDB（Atlas 等）
 *   2. 否则 → Node 文件系统（.data/）
 *
 * 关键顺序问题：Nitro 插件执行前，其他插件（availability）可能已经开始写数据。
 * 因此设置 MONGODB_URI 时，先把存储切到「内存缓冲」（绝不落盘），
 * Mongo 就绪后再把缓冲回放到 Mongo。否则 Workers 上会写只读磁盘直接报错。
 */
export default defineNitroPlugin(async () => {
  if (!process.env.MONGODB_URI) {
    console.log('[storage] MONGODB_URI 未设置，使用本地文件后端 (.data/)')
    return
  }

  // 先把可能抢先发生的写入兜住，不落磁盘
  beginRemoteTransition()

  const { installMongoBackend } = await import('../utils/mongodb')
  const ok = await installMongoBackend()
  if (!ok) {
    console.error('[storage] MongoDB 初始化失败，回退本地文件后端')
    const { fsBackend } = await import('../utils/storage')
    setStorageBackend(fsBackend)
  }
})