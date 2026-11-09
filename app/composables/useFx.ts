/**
 * 全站货币展示层：USD 标价 + 实时汇率换算 CNY。
 *  - 汇率来自 GET /api/rates（服务端 6h 缓存双源），由 app.vue 启动时注入 setFxRates()
 *  - 展示币种 CNY/USD 可切换，localStorage 记忆，默认 CNY（对外中文站优先人民币）
 *  - 所有价格组件调 useFx().fmtPrice(usd)，主显当前币种，副显另一种，汇率没到时优雅降级为 $
 */
import { ref } from 'vue'

export type Currency = 'CNY' | 'USD'

const currency = ref<Currency>('CNY')
const usdCny = ref<number>(0) // 0 = 未加载
const rateMeta = ref<{ updatedAt: string; source: string; fallback: boolean } | null>(null)

export function setFxRates(r: { usdCny: number; updatedAt: string; source: string; fallback: boolean } | null) {
  if (!r) return
  usdCny.value = r.usdCny
  rateMeta.value = { updatedAt: r.updatedAt, source: r.source, fallback: r.fallback }
}

export function useFx() {
  const rate = () => usdCny.value

  const fmtPrice = (usd: number): { main: string; sub: string } => {
    const r = rate()
    const cny = r ? usd * r : null
    const usdStr = `$${usd.toFixed(2)}`
    if (cny === null) return { main: usdStr, sub: '' }
    const cnyStr = `¥${cny.toFixed(2)}`
    return currency.value === 'CNY'
      ? { main: cnyStr, sub: usdStr }
      : { main: usdStr, sub: cnyStr }
  }

  /** 预算窗等「≤ $15/月」展示 */
  const fmtWindow = (usd: number): { main: string; sub: string } => fmtPrice(usd)

  /** 年付主显：yearMain=年付总价(当前币种) / yearSub=另一币种年付 / monthMain=月均(当前币种) */
  const fmtYear = (usdPerYear: number, usdPerMonth: number) => {
    const y = fmtPrice(usdPerYear)
    const m = fmtPrice(usdPerMonth)
    return {
      yearMain: `${y.main}/年`,
      yearSub: y.sub ? `≈${y.sub}` : '',
      monthMain: `${m.main}/月`
    }
  }

  const toggle = (c: Currency) => {
    currency.value = c
    if (import.meta.client) {
      try {
        localStorage.setItem('vpshunt:currency', c)
      } catch { /* 隐私模式忽略 */ }
    }
  }

  const rateLabel = computed(() =>
    usdCny.value ? `1 USD = ¥${usdCny.value.toFixed(4)}` : '汇率加载中…'
  )

  return { currency, usdCny, rateMeta, fmtPrice, fmtWindow, fmtYear, toggle, rateLabel, setFxRates }
}
