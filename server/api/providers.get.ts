import { getProviderRows, getState } from '../utils/db'

/** 厂商表：连通状态 + 套餐数 + 最低价 + 最近检测时间 */
export default defineEventHandler(() => {
  const rows = getProviderRows()
  const { lastRun } = getState()
  return {
    // 默认推荐序：有 aff 的厂商排前，其次按最低年付升序
    providers: rows.sort(
      (a, b) => Number(b.hasAff) - Number(a.hasAff) || (a.cheapestPerYear ?? 1e9) - (b.cheapestPerYear ?? 1e9)
    ),
    lastRun
  }
})
