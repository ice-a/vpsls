import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 官方源抓取基建：UA + 超时 + 24h 本地缓存。
 * 缓存与解析结果都在 .data/official/ 下，部署挂持久卷即可跨重启。
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const TIMEOUT_MS = 20000
const CACHE_TTL = 24 * 3600 * 1000

const dir = join(process.cwd(), '.data', 'official')
const cacheFile = join(dir, 'html-cache.json')

interface CacheShape {
  [url: string]: { at: number; status: number; body: string }
}

let cache: CacheShape | null = null

function loadCache(): CacheShape {
  if (cache) return cache
  if (existsSync(cacheFile)) {
    try {
      cache = JSON.parse(readFileSync(cacheFile, 'utf-8'))
    } catch {
      cache = {}
    }
  } else {
    cache = {}
  }
  return cache
}

function persistCache() {
  mkdirSync(dir, { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(cache), 'utf-8')
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
