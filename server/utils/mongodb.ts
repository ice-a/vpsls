import type { StorageBackend } from './storage'
import { setStorageBackend } from './storage'

/**
 * MongoDB 存储后端（Atlas / 任意 mongodb:// 兼容库）
 *
 * 设计约束：现有业务代码是同步读写（读缓存 → 计算 → 写回），
 * 而 MongoDB 驱动全异步。直接全链路 async 化要动 5 个模块十几个调用点，
 * 风险大收益小，因此沿用「内存快照 + 异步回写 + 启动预热」：
 *
 *   read(key)  → 读内存；内存没有时返回 null（上层用种子兜底），同时后台拉库回填
 *   write(key,content) → 立即写内存（后续请求可见），异步 upsert 到 Mongo
 *   warmup()   → 进程启动时把常用 key 一次性拉进内存，消除首请求空窗
 *
 * 集合：single-doc 模式 —— 一个 key 一条文档 { _id, data, updatedAt }，
 * 放在 vpsls.documents 集合里（库名 vpsls，不用 test）。
 */

interface MongoLike {
  collection(name: string): {
    findOne(filter: any): Promise<any>
    updateOne(filter: any, update: any, opts?: any): Promise<any>
    find(filter?: any): any
    createIndex(spec: any, opts?: any): Promise<any>
  }
}

interface MongoModule {
  MongoClient: new (uri: string, opts?: any) => {
    connect(): Promise<any>
    db(name?: string): MongoLike
    close(): Promise<void>
    on(event: string, cb: (...a: any[]) => void): void
  }
}

const DB_NAME = process.env.MONGODB_DB || 'vpsls'
const COLLECTION = 'documents'

const mem = new Map<string, string>()
const dirty = new Set<string>()
let collection: any = null
let client: any = null
let ready = false

/** 常用 key：启动预热，让首个请求就能读到真值 */
export const COMMON_KEYS = ['state.json', 'analytics.json', 'rates.json', 'official/plans.json']

async function getCollection(): Promise<any> {
  if (collection) return collection
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI 未配置')

  // 动态 import：Node 与 Workers 都能拿到，且不阻塞本地无 Mongo 的场景
  const mod: MongoModule = await import('mongodb')
  client = new mod.MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 5
  })
  await client.connect()
  const db = client.db(DB_NAME)
  collection = db.collection(COLLECTION)
  // key 唯一索引（_id 已内置，这里用 key 字段）
  await collection.createIndex({ key: 1 }, { unique: true }).catch(() => {})
  return collection
}

/** 从库里拉某个 key 到内存 */
async function pull(key: string): Promise<void> {
  try {
    const col = await getCollection()
    const doc = await col.findOne({ key })
    if (doc?.data != null && !mem.has(key)) mem.set(key, String(doc.data))
  } catch (e) {
    console.error(`[mongo] pull ${key} failed: ${(e as Error).message}`)
  }
}

/** 把内存里的 key 写回库（幂等 upsert） */
async function push(key: string): Promise<void> {
  const data = mem.get(key)
  if (data === undefined) return
  try {
    const col = await getCollection()
    await col.updateOne(
      { key },
      { $set: { key, data, updatedAt: new Date() } },
      { upsert: true }
    )
    dirty.delete(key)
  } catch (e) {
    console.error(`[mongo] push ${key} failed: ${(e as Error).message}`)
  }
}

/** 安装 MongoDB 后端并预热常用 key */
export async function installMongoBackend(): Promise<boolean> {
  if (!process.env.MONGODB_URI) return false
  try {
    await getCollection()
    await Promise.all(COMMON_KEYS.map(pull))
    ready = true
    console.log(`[mongo] backend ready, db=${DB_NAME}, warmed=${mem.size} keys`)
  } catch (e) {
    console.error(`[mongo] backend init failed, fallback to fs/memory: ${(e as Error).message}`)
    return false
  }

  const backend: StorageBackend = {
    read(key) {
      const hit = mem.get(key)
      if (hit !== undefined) return hit
      // 未命中：后台拉，本次返回 null（上层种子兜底）
      void pull(key)
      return null
    },
    write(key, content) {
      mem.set(key, content)
      dirty.add(key)
      void push(key)
    }
  }
  setStorageBackend(backend)
  return true
}

/** cron / 手动刷新时把内存全部刷回库 */
export async function flushMongo(): Promise<void> {
  if (!ready) return
  await Promise.all([...mem.keys()].map(push))
}

export const mongoReady = () => ready
export const mongoMemKeys = () => [...mem.keys()]
export const mongoDirtyKeys = () => [...dirty]