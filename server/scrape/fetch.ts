import { storageRead, storageWrite } from '../utils/storage'

/**
 * 官方源抓取基建：UA + 超时 + 24h 缓存。
 * 缓存键 official/html-cache.json 与解析结果 official/plans.json：
 * Node → .data/official/*.json；Workers → KV。
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const TIMEOUT_MS = 20000
const CACHE_TTL = 24 * 3600 * 1000

const CACHE_KEY = 'official/html-cache.json'

interface CacheShape {
  [url: string]: { at: number; status: number; body: string }
}

let cache: CacheShape | null = null

function loadCache(): CacheShape {
  if (cache) return cache
  const raw = storageRead(CACHE_KEY)
  if (raw) {
    try {
      cache = JSON.parse(raw)
    } catch {
      cache = {}
    }
  } else {
    cache = {}
  }
  return cache
}

function persistCache() {
  if (!cache) return
  // HTML 缓存体积大（≈1.8MB），KV 单值上限 25MB 够用；超限时截断到近期条目
  storageWrite(CACHE_KEY, JSON.stringify(cache))
}

/** 抓页面：命中 24h 缓存直接用；force=true 强制重抓 */
export async function fetchPage(
  url: string,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; body: string; status: number; fromCache: boolean }> {
  const c = loadCache()
  const hit = c[url]
  if (!opts.force && hit && Date.now() - hit.at < CACHE_TTL && hit.status === 200 && hit.body) {
    return { ok: true, body: hit.body, status: 200, fromCache: true }
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    })
    const body = await res.text()
    const ok = res.ok
    if (ok) {
      c[url] = { at: Date.now(), status: res.status, body }
      persistCache()
    }
    return { ok, body, status: res.status, fromCache: false }
  } catch (err) {
    // 网络失败时用过期缓存兜底，宁可旧也不空
    if (hit?.body) return { ok: true, body: hit.body, status: hit.status, fromCache: true }
    return { ok: false, body: '', status: 0, fromCache: false }
  }
}