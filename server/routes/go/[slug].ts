import { getProvider } from '../../utils/db'
import { buildAffUrl } from '#shared/aff'

/**
 * 统一出口跳转：站内所有「查看/购买」链接走 /go/:slug，
 * 服务端在这里把裸链接替换为你的 aff 链接后 302。
 *
 *  - aff 配置：shared/aff.ts（全局兜底 + 单厂商专属）
 *  - ?src=xxx 可带来源标记（榜单/筛选器/首页），便于后续分析
 *  - CLICK_BEACON 配了收集端点则 fire-and-forget 上报一次
 */
export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')!
  const provider = getProvider(slug)
  if (!provider) {
    throw createError({ statusCode: 404, statusMessage: `unknown provider: ${slug}` })
  }

  const target = buildAffUrl(slug, provider.url)
  const beacon = process.env.AFF_BEACON ?? ''
  if (beacon) {
    const src = getQuery(event).src ?? 'direct'
    // 不阻塞跳转：失败就失败，埋点从不挡路
    fetch(`${beacon}${beacon.includes('?') ? '&' : '?'}p=${slug}&src=${encodeURIComponent(String(src))}`)
      .catch(() => {})
  }

  return sendRedirect(event, target, 302)
})
