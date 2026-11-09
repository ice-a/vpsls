/**
 * aff 集中配置 —— 全站所有跳转链接都从这里出去，换 aff 只改这一个文件。
 *
 * 规则（按你的口径）：
 *  1. PROVIDER_AFF 命中 → 出该厂商专属 aff 链接；
 *  2. 未配置的厂商 → 不填 aff，裸链直出（不拼任何推广参数）；
 *  3. 以后想加统一兜底再动 DEFAULT：
 *     - DEFAULT_MODE='GET' + DEFAULT_REF='你的ID' → 裸链拼 ?ref=你的ID
 *     - DEFAULT_MODE='NONE' + DEFAULT_AFF_URL='完整链接' → 整链替换
 *
 * 站内跳转统一走 /go/:slug，服务端在这里查表拼最终 URL。
 * 注意：PROVIDER_AFF 的键必须等于厂商 slug（server/data/providers.ts），否则不命中。
 */
export const AFF_CONFIG = {
  /** 兜底整链（仅 DEFAULT_MODE='NONE' 且非空时生效；空 = 裸链直出） */
  DEFAULT_AFF_URL: '',

  /** 兜底拼参方式：NONE=不填 aff（默认）；GET=裸链拼 DEFAULT_REF */
  DEFAULT_MODE: 'NONE' as 'GET' | 'NONE',
  /** GET 模式下的全局 ref（留空等同 NONE） */
  DEFAULT_REF: '',

  /** 单厂商专属 aff 链接：key = 厂商 slug；没配的厂商走裸链 */
  PROVIDER_AFF: {
    racknerd: 'https://my.racknerd.com/aff.php?aff=13897',
    vultr: 'https://www.vultr.com/?ref=9526803',
    justhost: 'https://justhost.asia/?ref=387918',
    zgovps: 'https://www.zgoesim.com/?ref=llgwinzy', // 厂商 slug=zgovps；指向你的 zgoesim 推广链
    zgoesim: 'https://www.zgoesim.com/?ref=llgwinzy', // 别名：防键写错不命中
    colocrossing: 'https://cloud.colocrossing.com/aff.php?aff=1191'
  } as Record<string, string>,

  /** 点击埋点（可选）：填一个自己的收集端点，会以 GET query 方式上报，不填则跳过 */
  CLICK_BEACON: '' // 'https://example.com/collect'
}

/** 拼装某个厂商的最终跳转 URL：有专属给专属，没有就不填 aff（裸链） */
export function buildAffUrl(slug: string, rawUrl: string): string {
  const special = AFF_CONFIG.PROVIDER_AFF[slug]
  if (special) return special

  if (AFF_CONFIG.DEFAULT_MODE === 'GET' && AFF_CONFIG.DEFAULT_REF) {
    const join = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${join}ref=${encodeURIComponent(AFF_CONFIG.DEFAULT_REF)}`
  }
  if (AFF_CONFIG.DEFAULT_MODE === 'NONE' && AFF_CONFIG.DEFAULT_AFF_URL) {
    return AFF_CONFIG.DEFAULT_AFF_URL
  }
  return rawUrl
}

/** 该厂商的出口是否带 aff（配置驱动：改 PROVIDER_AFF/DEFAULT 本判定自动跟随） */
export function hasAffProvider(slug: string, rawUrl: string): boolean {
  return buildAffUrl(slug, rawUrl) !== rawUrl
}
