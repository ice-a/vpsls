import type { BillingCycle } from '#shared/types'

/**
 * 官方页面解析器 —— 结构全部来自 .probe/ 真实样本解剖，不猜正则：
 *  - whmcs-old   bwh：`<div class="cartbox">` 卡 + `<strong><nobr>名` + SSD/RAM/CPU 键值 + `class="pricing"` 价签 + pid 下单
 *  - whmcs-new   cc/bytevirt/dedione：`<div class="package" id="productN">` 卡 + `h3.package-title` + `package-content` 规格 + `price-amount`/`price-cycle`
 *  - wapac       `id="productN-name"` 名 + `productN-description` 规格描述 + `span.price` 价（中文「每月」）
 *  - ovh         `product-card__title` 名（VPS-1…）+ `price-value $x.xx /month`（卡片无规格 → 留空 UI 显 —）
 * 解析失败返回 []，由上层回退种子，绝不半猜半填。
 */

export interface ScrapedPlan {
  name: string
  /** 已换算成美元标价（€ 页面按 1.08 静态折算，样本中未出现 € 实例） */
  price: number
  cycle: BillingCycle
  cpu?: number
  ram?: number // GB
  disk?: number // GB
  diskType?: 'NVMe' | 'SSD' | 'HDD'
  bandwidth?: number // Mbps
  traffic?: string
  regions: string[]
  url: string
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/ /g, ' ')
    .replace(/&/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const toNum = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : undefined
}

/** 价格文本 → 美元数字（含 € 静态折算） */
const usdOf = (raw: string, numStr: string): number => {
  const n = parseFloat(numStr)
  if (!Number.isFinite(n)) return NaN
  return raw.includes('€') ? Math.round(n * 1.08 * 100) / 100 : n
}

const cycleOf = (s: string): BillingCycle => {
  const t = s.toLowerCase()
  if (t.includes('semi') || t.includes('半年')) return 'semiannual'
  if (t.includes('quarter') || t.includes('季')) return 'quarterly'
  if (t.includes('annual') || t.includes('year') || t.includes('年')) return 'yearly'
  return 'monthly'
}

const DIV: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }
export const perMonthOf = (price: number, cycle: BillingCycle) => Math.round((price / DIV[cycle]) * 100) / 100

/** 从文本猜机房区域（多命中全收）；空则用调用方给的兜底 */
export function mapRegions(text: string, fallback: string[]): string[] {
  const table: Array<[RegExp, string]> = [
    [/Hong Kong|香港/i, 'ASIA'],
    [/Japan|Tokyo|日本/i, 'ASIA'],
    [/Taiwan|台湾|新北/i, 'ASIA'],
    [/Singapore|新加坡/i, 'ASIA'],
    [/Korea|韩国/i, 'ASIA'],
    [/Los Angeles|LAX|美西/i, 'US-WEST'],
    [/Missouri|New York|美东|Ashburn/i, 'US-EAST'],
    [/Germany|Frankfurt|France|Germany|欧洲|德国|法国/i, 'EU'],
    [/Russia|Moscow|俄罗斯/i, 'RU']
  ]
  const hit = new Set<string>()
  for (const [re, code] of table) if (re.test(text)) hit.add(code)
  return hit.size ? [...hit] : fallback
}

// ---------- whmcs-old（bwh） ----------
export function parseWhmcsOld(html: string, baseUrl: string, defaultRegions: string[]): ScrapedPlan[] {
  const cards = html.split('<div class="cartbox">').slice(1)
  const out: ScrapedPlan[] = []
  for (const card of cards) {
    const nameM = /<strong><nobr>([\s\S]*?)<\/nobr><\/strong>|<strong>([^<]{2,80})<\/strong>/.exec(card)
    const name = stripTags(nameM?.[1] ?? nameM?.[2] ?? '')
    if (!name) continue

    // 价签区可能多行（$52.99 Semi-Annually / $99.99 Annually）→ 全部取出，按月单价取最低
    const priceHits = [...card.matchAll(/(€|\$)\s?([\d.]+)\s?USD?\s?\s?(Monthly|Quarterly|Semi-Annually|Annually)/gi)]
    if (!priceHits.length) continue
    let best: { price: number; cycle: BillingCycle } | null = null
    for (const m of priceHits) {
      const price = usdOf(m[1], m[2])
      const cycle = cycleOf(m[3])
      if (!best || perMonthOf(price, cycle) < perMonthOf(best.price, best.cycle)) best = { price, cycle }
    }
    if (!best) continue

    const ram = toNum(/RAM:\s*([\d.]+)\s*GB/i.exec(card)?.[1])
    const disk = toNum(/(SSD|HDD|NVMe):\s*([\d.]+)\s*GB/i.exec(card)?.[2])
    const diskType = (/(SSD|HDD|NVMe):\s*[\d.]+\s*GB/i.exec(card)?.[1]?.toUpperCase() as 'SSD' | 'HDD' | 'NVMe') || 'SSD'
    const cpu = toNum(/CPU:\s*([\d.]+)/i.exec(card)?.[1])
    const trafficM = /Transfer:\s*([\d.]+\s*TB\/mo)/i.exec(card)?.[1]
    const linkM = /Link speed:\s*([\d.]+)\s*(Gigabit|Mbps)/i.exec(card)
    const bandwidth = linkM ? toNum(linkM[1])! * (linkM[2].toLowerCase().startsWith('giga') ? 1000 : 1) : undefined
    const pid = /cart\.php\?a=add&pid=(\d+)/.exec(card)?.[1]

    out.push({
      name,
      price: best.price,
      cycle: best.cycle,
      cpu,
      ram,
      disk,
      diskType,
      bandwidth,
      traffic: trafficM ? trafficM.replace('/mo', 'TB/月').replace(/\s+/g, '') : undefined,
      regions: mapRegions(stripTags(card), defaultRegions),
      url: pid ? `${baseUrl}/cart.php?a=add&pid=${pid}` : baseUrl
    })
  }
  return out
}

// ---------- whmcs-new（cc / bytevirt / dedione） ----------
export function parseWhmcsNew(html: string, baseUrl: string, defaultRegions: string[]): ScrapedPlan[] {
  const cards = html.split(/<div class="package" id="product\d+">/).slice(1)
  const out: ScrapedPlan[] = []
  const seen = new Set<string>()
  for (const card of cards) {
    const name = stripTags(/<h3 class="package-title">([\s\S]*?)<\/h3>/.exec(card)?.[1] ?? '')
    if (!name || seen.has(name)) continue

    const priceM = /class="price-amount">\s*(€|\$|US\$)\s?([\d.]+)/.exec(card)
    if (!priceM) continue
    const price = usdOf(priceM[1], priceM[2])
    const cycleText = /class="price-cycle[^"]*">([\s\S]{0,120}?)<\//.exec(card)?.[1] ?? ''
    const cycle = cycleOf(stripTags(cycleText) || name)

    const body = stripTags(card)
    const ram = toNum(/(\d+)\s*GB\s*RAM|RAM[:：]\s*(\d+)\s*GB|(\d+)G\s*RAM/i.exec(body)?.slice(1).find(x => x) )
    const cpu = toNum(/(\d+)\s*(?:CPU Cores|vCPU|Cores)|CPU[:：]\s*(\d+)/i.exec(body)?.slice(1).find(x => x))
    const diskM = /(\d+)\s*GB\s*(SSD|NVMe|HDD)|SSD[:：]\s*(\d+)\s*GB/i.exec(body)
    const disk = toNum(diskM?.[1] ?? diskM?.[3])
    const diskType = ((diskM?.[2] ?? diskM?.[1] ? diskM?.[2] : undefined)?.toUpperCase() as 'SSD' | 'NVMe' | 'HDD' | undefined) || (disk ? 'SSD' : undefined)
    const trafficM = /(\d+)\s*TB\s*Bandwidth/i.exec(body)

    seen.add(name)
    out.push({
      name,
      price,
      cycle,
      cpu,
      ram,
      disk,
      diskType,
      bandwidth: undefined,
      traffic: trafficM ? `${trafficM[1]}TB/月` : undefined,
      regions: mapRegions(card, defaultRegions),
      url: baseUrl
    })
  }
  return out
}

// ---------- wapac ----------
export function parseWapac(html: string, baseUrl: string, defaultRegions: string[]): ScrapedPlan[] {
  const cards = html.split(/<div class="product clearfix" id="product\d+">/).slice(1)
  const out: ScrapedPlan[] = []
  for (const card of cards) {
    const name = stripTags(/id="product\d+-name">([\s\S]*?)<\/span>/.exec(card)?.[1] ?? '')
    if (!name) continue
    const priceM = /class="price">\s*(€|\$|US\$)\s?([\d.]+)/.exec(card)
    if (!priceM) continue
    const price = usdOf(priceM[1], priceM[2])
    // 价区上下文里带「每月/每年」；缺失按月付
    const priceCtx = card.slice(Math.max(0, priceM.index! - 60), priceM.index! + 120)
    const cycle = cycleOf(stripTags(priceCtx))

    const descM = /id="product\d+-description">([\s\S]*?)<\/p>/.exec(card)
    const desc = descM ? descM[1].replace(/<br\s*\/?>/gi, '\n') : ''
    const cpu = toNum(/(\d+)\s*CPU/i.exec(desc)?.[1])
    const ram = toNum(/(\d+)G\s*RAM/i.exec(desc)?.[1])
    const disk = toNum(/(\d+)GB\s*(SSD|NVMe|HDD)/i.exec(desc)?.[1])
    const diskType = (/(?:\d+)GB\s*(SSD|NVMe|HDD)/i.exec(desc)?.[1]?.toUpperCase() as 'SSD' | 'NVMe' | 'HDD' | undefined) || undefined
    const bwM = /(\d+)TB\s*@\s*(\d+)\s*Mbps/i.exec(desc)

    out.push({
      name,
      price,
      cycle,
      cpu,
      ram,
      disk,
      diskType,
      bandwidth: bwM ? toNum(bwM[2]) : undefined,
      traffic: bwM ? `${bwM[1]}TB/月` : undefined,
      regions: mapRegions(desc, defaultRegions),
      url: baseUrl
    })
  }
  return out
}

// ---------- OVH ----------
export function parseOvh(html: string, baseUrl: string, defaultRegions: string[]): ScrapedPlan[] {
  const out: ScrapedPlan[] = []
  const priceIdx = [...html.matchAll(/class="price-value">\s*\$?\s?([\d.]+)\s*<\/span><span class="price-suffix">\s*\/(month)/g)]
  for (const m of priceIdx) {
    const idx = m.index!
    // 价签往前找最近一个卡片标题（VPS-1 / VPS-2 / content-2GB 等）
    const before = html.slice(Math.max(0, idx - 2600), idx)
    const nameM = [...before.matchAll(/product-card__title[\s\S]*?otds-text[^>]*>\s*([^<]+?)\s*<\/div>/g)].pop()
    const name = nameM?.[1]?.trim() ?? ''
    if (!name) continue
    const price = parseFloat(m[1])
    if (!Number.isFinite(price)) continue
    out.push({
      name,
      price,
      cycle: 'monthly',
      regions: mapRegions(before, defaultRegions),
      url: baseUrl
    })
  }
  // 标题去重（同卡两处价签）
  const seen = new Set<string>()
  return out.filter(p => (seen.has(p.name) ? false : (seen.add(p.name), true)))
}
