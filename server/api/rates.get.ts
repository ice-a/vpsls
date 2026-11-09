import { getRates } from '../utils/rates'

/** 汇率查询：GET /api/rates → { usdCny, updatedAt, source, fallback } */
export default defineEventHandler(async () => {
  return getRates()
})
