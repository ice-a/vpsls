import { recordClick, recordPageView } from '../utils/analytics'

/**
 * 全局访问埋点（Nitro middleware，每个请求都会过）：
 *  - HTML 页面打开（GET、排除静态资源 / API / 出口跳转）→ 页面 PV
 *  - /go/:slug 出口点击 → 产品级（?offer=of_xxx）或厂商级 key
 */
export default defineEventHandler((event) => {
  if (event.method !== 'GET') return

  const path = (event.path ?? '/').split('?')[0]

  // 出口点击
  if (path.startsWith('/go/')) {
    const slug = path.slice(4).split('/')[0] ?? ''
    if (slug) {
      const offer = getQuery(event).offer
      recordClick(typeof offer === 'string' && offer ? offer : `provider:${slug}`)
    }
    return
  }

  // 页面 PV：只数 HTML 文档请求
  const isPage =
    !path.startsWith('/api') &&
    !path.startsWith('/_') &&
    !path.startsWith('/__nuxt') &&
    !path.includes('.') && // 带扩展名的当静态资源
    path !== '/favicon.ico'
  if (!isPage) return

  const accept = event.node.req.headers.accept ?? ''
  if (!accept.includes('text/html')) return

  recordPageView(path)
})
