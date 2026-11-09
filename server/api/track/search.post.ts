import { normalizeConditions, recordSearch } from '../../utils/analytics'

/**
 * 搜索条件上报（筛选器在浏览器端完成，条件变化时 POST 这里）
 * POST /api/track/search  body: { conditions: { window: "15", region: "ASIA", ... } }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ conditions?: Record<string, string | number | null | undefined> }>(event).catch(() => null)
  const condStr = normalizeConditions(body?.conditions ?? {})
  if (!condStr) return { ok: false, reason: 'empty conditions' }
  recordSearch(condStr)
  return { ok: true, condition: condStr }
})
