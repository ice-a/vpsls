import { warmupRates } from '../utils/rates'

/**
 * 启动即预热汇率（异步，不阻塞）：
 * 保证首访 /api/rates 就能拿到实时代价，而不是先吐一次回退值。
 * 之后由 getRates 的 6h TTL 自动续期。
 */
export default defineNitroPlugin(() => {
  warmupRates()
    .then(r => console.log(`[rates] warmed: 1 USD = ${r.usdCny} CNY (${r.source})`))
    .catch(err => console.error('[rates] warmup failed:', err))
})
