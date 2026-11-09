import type { BillingCycle, Offer, OsFamily } from '#shared/types'
import { cycleLabel as _cycleLabel } from '#shared/format'
import { SEED_PROVIDERS } from './providers'

export const cycleLabel = _cycleLabel

/**
 * 套餐种子数据。价格为各厂商公开牌价的示意快照，
 * 接入你自己的价格源后整体替换即可（保持字段结构）。
 *
 * 元组字段：
 * [providerSlug, title, cpu, ramGB, diskGB, diskType, bandwidthMbps, traffic, regions, price, cycle, os, tags, rawUrl, featured?]
 */
type Row = [
  string, string, number, number, number, 'NVMe' | 'SSD' | 'HDD', number,
  string, string[], number, BillingCycle, OsFamily, string[], string, boolean?
]

const ROWS: Row[] = [
  // —— RackNerd：低价年付主力 ——
  ['racknerd', 'KVM · 美西年付入门', 1, 1, 20, 'SSD', 1000, '3TB/月', ['US-WEST'], 10.98, 'yearly', 'linux', ['年付神价'], 'https://racknerd.com', true],
  ['racknerd', 'KVM · 美西年付进阶', 2, 2.5, 50, 'SSD', 1000, '5TB/月', ['US-WEST'], 16.98, 'yearly', 'linux', ['年付神价'], 'https://racknerd.com'],
  ['racknerd', 'KVM · 美东年付大流量', 2, 4, 80, 'SSD', 1000, '8TB/月', ['US-EAST'], 24.98, 'yearly', 'linux', ['大流量'], 'https://racknerd.com'],
  ['racknerd', 'KVM · 月付随时跑路款', 1, 1, 25, 'SSD', 1000, '3TB/月', ['US-EAST'], 3.49, 'monthly', 'linux', ['月付'], 'https://racknerd.com'],

  // —— Vultr ——
  ['vultr', 'Cloud Compute · 高频', 1, 1, 25, 'SSD', 1000, '2TB/月', ['US-EAST'], 6, 'monthly', 'linux', ['按小时计费'], 'https://www.vultr.com'],
  ['vultr', 'Cloud Compute · 通用', 2, 4, 80, 'SSD', 1000, '5TB/月', ['US-EAST'], 24, 'monthly', 'linux', ['按小时计费'], 'https://www.vultr.com'],
  ['vultr', 'Cloud Compute · 高配', 4, 8, 160, 'SSD', 1000, '8TB/月', ['EU'], 48, 'monthly', 'linux', ['按小时计费'], 'https://www.vultr.com'],
  ['vultr', 'Windows 云服务器', 2, 4, 100, 'SSD', 1000, '3TB/月', ['US-EAST'], 42, 'monthly', 'windows', ['Windows'], 'https://www.vultr.com', true],

  // —— DigitalOcean ——
  ['digitalocean', 'Droplet · Basic', 1, 1, 25, 'SSD', 1000, '1TB/月', ['US-EAST'], 6, 'monthly', 'linux', ['开发者首选'], 'https://www.digitalocean.com'],
  ['digitalocean', 'Droplet · Basic+', 2, 2, 50, 'SSD', 1000, '2TB/月', ['US-EAST'], 12, 'monthly', 'linux', ['开发者首选'], 'https://www.digitalocean.com'],
  ['digitalocean', 'Droplet · 通用型', 4, 8, 160, 'SSD', 1000, '4TB/月', ['EU'], 48, 'monthly', 'linux', ['开发者首选'], 'https://www.digitalocean.com'],

  // —— Linode ——
  ['linode', 'Shared · Nanode', 1, 1, 25, 'SSD', 1000, '1TB/月', ['US-EAST'], 5, 'monthly', 'linux', ['老牌稳定'], 'https://www.linode.com'],
  ['linode', 'Shared · 2GB', 2, 2, 50, 'SSD', 1000, '2TB/月', ['EU'], 10, 'monthly', 'linux', ['老牌稳定'], 'https://www.linode.com'],
  ['linode', 'Dedicated · 4核', 4, 8, 160, 'SSD', 1000, '5TB/月', ['ASIA'], 90, 'monthly', 'linux', ['独享CPU'], 'https://www.linode.com'],

  // —— Hetzner ——
  ['hetzner', 'Cloud · CX22', 2, 4, 40, 'NVMe', 1000, '20TB/月', ['EU'], 4.52, 'monthly', 'linux', ['性能猛兽'], 'https://www.hetzner.com', true],
  ['hetzner', 'Cloud · CX32', 4, 8, 80, 'NVMe', 1000, '20TB/月', ['EU'], 8.38, 'monthly', 'linux', ['性能猛兽'], 'https://www.hetzner.com'],
  ['hetzner', 'Cloud · CPX31', 4, 8, 160, 'NVMe', 1000, '20TB/月', ['EU'], 15.19, 'monthly', 'linux', ['性能猛兽', '大流量'], 'https://www.hetzner.com'],
  ['hetzner', 'Cloud · 高内存型', 8, 32, 320, 'NVMe', 1000, '20TB/月', ['EU'], 52.9, 'monthly', 'linux', ['大内存'], 'https://www.hetzner.com'],

  // —— OVHcloud ——
  ['ovhcloud', 'VPS · Starter', 1, 2, 20, 'SSD', 250, '不限量', ['EU'], 3.5, 'monthly', 'linux', ['防DDoS'], 'https://www.ovhcloud.com'],
  ['ovhcloud', 'VPS · Value', 2, 4, 40, 'SSD', 500, '不限量', ['EU'], 6.5, 'monthly', 'linux', ['防DDoS'], 'https://www.ovhcloud.com'],
  ['ovhcloud', 'VPS · Essential', 4, 8, 80, 'SSD', 1000, '不限量', ['US-EAST'], 12.5, 'monthly', 'linux', ['防DDoS'], 'https://www.ovhcloud.com'],

  // —— Contabo ——
  ['contabo', 'VPS · S', 4, 8, 50, 'SSD', 32, '32TB/月', ['EU'], 5.99, 'monthly', 'linux', ['大硬盘'], 'https://contabo.com'],
  ['contabo', 'VPS · M', 6, 16, 100, 'SSD', 32, '32TB/月', ['EU'], 10.49, 'monthly', 'linux', ['大硬盘'], 'https://contabo.com'],
  ['contabo', 'VPS · L', 8, 32, 200, 'SSD', 32, '32TB/月', ['US-EAST'], 16.49, 'monthly', 'linux', ['大硬盘'], 'https://contabo.com'],
  ['contabo', 'VPS · XL', 10, 64, 400, 'SSD', 32, '32TB/月', ['ASIA'], 26.49, 'monthly', 'linux', ['大硬盘'], 'https://contabo.com'],

  // —— 搬瓦工 ——
  ['bandwagon', 'CN2 GIA · 年付入门', 1, 1, 20, 'SSD', 1000, '1TB/月', ['US-WEST'], 49.99, 'yearly', 'linux', ['CN2 GIA'], 'https://bwh81.net', true],
  ['bandwagon', 'CN2 GIA · 年付标准', 2, 2, 40, 'SSD', 2500, '2TB/月', ['US-WEST'], 99.99, 'yearly', 'linux', ['CN2 GIA'], 'https://bwh81.net'],
  ['bandwagon', 'CN2 · 年付经济', 1, 1, 20, 'SSD', 1000, '1TB/月', ['US-WEST'], 29.99, 'yearly', 'linux', ['CN2 GT'], 'https://bwh81.net'],
  ['bandwagon', '香港 CN2 · 年付', 1, 2, 40, 'SSD', 1000, '500GB/月', ['ASIA'], 169.99, 'yearly', 'linux', ['低延迟'], 'https://bwh81.net'],

  // —— VMISS ——
  ['vmiss', '香港 CN2 · 年付', 1, 1, 10, 'SSD', 1000, '1TB/月', ['ASIA'], 21.6, 'yearly', 'linux', ['CN2'], 'https://vmiss.com', true],
  ['vmiss', '日本 IIJ · 年付', 1, 1, 10, 'SSD', 1000, '1TB/月', ['ASIA'], 24, 'yearly', 'linux', ['日本优化'], 'https://vmiss.com'],
  ['vmiss', '洛杉矶 CN2 · 年付', 2, 2, 20, 'SSD', 1000, '2TB/月', ['US-WEST'], 28.8, 'yearly', 'linux', ['CN2'], 'https://vmiss.com'],
  ['vmiss', '韩国 BGP · 年付', 1, 2, 20, 'SSD', 1000, '1TB/月', ['ASIA'], 36, 'yearly', 'linux', ['韩国'], 'https://vmiss.com'],

  // —— ZgoVPS ——
  ['zgovps', '洛杉矶 CN2 GIA · 年付', 2, 2, 40, 'NVMe', 1000, '2TB/月', ['US-WEST'], 42, 'yearly', 'linux', ['CN2 GIA'], 'https://zgovps.com', true],
  ['zgovps', '洛杉矶 CN2 GIA · 高配', 4, 8, 80, 'NVMe', 1000, '4TB/月', ['US-WEST'], 96, 'yearly', 'linux', ['CN2 GIA'], 'https://zgovps.com'],
  ['zgovps', '香港 CN2 · 季付', 2, 4, 40, 'NVMe', 1000, '1TB/月', ['ASIA'], 39, 'quarterly', 'linux', ['低延迟'], 'https://zgovps.com'],

  // —— Dogyun ——
  ['dogyun', '香港 BGP · 半年付', 2, 2, 30, 'NVMe', 1000, '1.5TB/月', ['ASIA'], 29, 'semiannual', 'linux', ['网络稳'], 'https://www.dogyun.com'],
  ['dogyun', '日本软银 · 半年付', 2, 4, 40, 'NVMe', 1000, '2TB/月', ['ASIA'], 36, 'semiannual', 'linux', ['软银线'], 'https://www.dogyun.com'],
  ['dogyun', '香港高防 · 年付', 4, 8, 60, 'NVMe', 1000, '3TB/月', ['ASIA'], 168, 'yearly', 'linux', ['高防'], 'https://www.dogyun.com'],

  // —— JustHost ——
  ['justhost', '俄区入门 · 年付', 1, 0.5, 5, 'HDD', 1000, '不限量', ['RU'], 13.92, 'yearly', 'linux', ['白菜价'], 'https://justhost.ru'],
  ['justhost', '俄区标准 · 年付', 1, 1, 15, 'SSD', 1000, '不限量', ['RU'], 21.6, 'yearly', 'linux', ['白菜价'], 'https://justhost.ru'],
  ['justhost', '俄区大内存 · 年付', 2, 4, 30, 'SSD', 1000, '不限量', ['EU'], 39.6, 'yearly', 'linux', ['白菜价'], 'https://justhost.ru'],

  // —— ColoCrossing ——
  ['colocrossing', '美东入门 · 年付', 1, 1, 20, 'SSD', 1000, '4TB/月', ['US-EAST'], 11.99, 'yearly', 'linux', ['便宜'], 'https://colocrossing.com', true],
  ['colocrossing', '美东标准 · 年付', 2, 2, 40, 'SSD', 1000, '6TB/月', ['US-EAST'], 23.88, 'yearly', 'linux', ['便宜'], 'https://colocrossing.com'],
  ['colocrossing', '美东高配 · 年付', 4, 8, 100, 'SSD', 1000, '10TB/月', ['US-EAST'], 47.88, 'yearly', 'linux', ['便宜'], 'https://colocrossing.com'],

  // —— Bytevirt ——
  ['bytevirt', '香港 CN2 · 年付', 1, 0.5, 5, 'NVMe', 1000, '500GB/月', ['ASIA'], 12, 'yearly', 'linux', ['超低价'], 'https://bytevirt.com'],
  ['bytevirt', '日本软银 · 年付', 1, 1, 10, 'NVMe', 1000, '1TB/月', ['ASIA'], 18, 'yearly', 'linux', ['超低价'], 'https://bytevirt.com'],
  ['bytevirt', '洛杉矶 CN2 · 年付', 2, 2, 20, 'NVMe', 1000, '1.5TB/月', ['US-WEST'], 24, 'yearly', 'linux', ['CN2'], 'https://bytevirt.com'],

  // —— WAP.AC ——
  ['wapac', '台湾入门 · 年付', 1, 0.5, 5, 'SSD', 1000, '500GB/月', ['ASIA'], 12, 'yearly', 'linux', ['台湾机房'], 'https://wap.ac', true],
  ['wapac', '台湾标准 · 年付', 1, 1, 10, 'SSD', 1000, '1TB/月', ['ASIA'], 24, 'yearly', 'linux', ['台湾机房'], 'https://wap.ac'],
  ['wapac', '台湾高配 · 年付', 2, 2, 20, 'SSD', 1000, '1.5TB/月', ['ASIA'], 48, 'yearly', 'linux', ['台湾机房'], 'https://wap.ac'],

  // —— DediOne ——
  ['dedione', '密苏里 NVMe · 年付', 1, 1, 20, 'NVMe', 1000, '3TB/月', ['US-EAST'], 12.99, 'yearly', 'linux', ['NVMe'], 'https://dedione.com'],
  ['dedione', '洛杉矶 NVMe · 年付', 2, 2, 40, 'NVMe', 1000, '4TB/月', ['US-WEST'], 23.88, 'yearly', 'linux', ['NVMe'], 'https://dedione.com'],
  ['dedione', '密苏里大盘 · 年付', 2, 4, 200, 'NVMe', 1000, '6TB/月', ['US-EAST'], 39.99, 'yearly', 'linux', ['大硬盘'], 'https://dedione.com'],

  // —— CloudServer ——
  ['cloudserver', '多机房入门 · 年付', 1, 1, 20, 'SSD', 1000, '2TB/月', ['US-WEST'], 10, 'yearly', 'linux', ['超低价'], 'https://cloudserver.com', true],
  ['cloudserver', '多机房标准 · 年付', 2, 2, 40, 'SSD', 1000, '3TB/月', ['US-WEST'], 18, 'yearly', 'linux', ['超低价'], 'https://cloudserver.com'],

  // —— HostHatch ——
  ['hosthatch', '欧洲 HV1 · 半年付', 1, 1, 25, 'SSD', 1000, '2TB/月', ['EU'], 3.5, 'semiannual', 'linux', ['欧洲便宜'], 'https://hosthatch.com'],
  ['hosthatch', '欧洲 HV2 · 半年付', 2, 2, 50, 'SSD', 1000, '4TB/月', ['EU'], 6, 'semiannual', 'linux', ['欧洲便宜'], 'https://hosthatch.com'],
  ['hosthatch', '美东大硬盘 · 年付', 2, 4, 100, 'SSD', 1000, '5TB/月', ['US-EAST'], 28, 'yearly', 'linux', ['大硬盘'], 'https://hosthatch.com'],

  // —— Windows 专区 ——
  ['contabo', 'Windows VPS · M', 4, 8, 120, 'SSD', 32, '32TB/月', ['EU'], 18.49, 'monthly', 'windows', ['Windows'], 'https://contabo.com'],
  ['linode', 'Windows · 2GB', 2, 4, 60, 'SSD', 1000, '2TB/月', ['US-EAST'], 70, 'monthly', 'windows', ['Windows'], 'https://www.linode.com'],
  ['ovhcloud', 'Windows VPS · Value', 2, 4, 60, 'SSD', 500, '不限量', ['EU'], 15, 'monthly', 'windows', ['Windows'], 'https://www.ovhcloud.com']
]

const CYCLE_DIVISOR: Record<BillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12
}

/** 元组 → 完整 Offer；perMonth = 期价折算月单价 */
export function buildOffers(): Offer[] {
  const slugs = new Set(SEED_PROVIDERS.map(p => p.slug))
  return ROWS.map((r, i) => {
    const [providerSlug, title, cpu, ram, disk, diskType, bandwidth, traffic, regions, price, cycle, os, tags, url, featured] = r
    if (!slugs.has(providerSlug)) throw new Error(`offer #${i} 引用了不存在的厂商: ${providerSlug}`)
    const perMonth = Math.round((price / CYCLE_DIVISOR[cycle]) * 100) / 100
    return {
      id: `of_${i.toString().padStart(3, '0')}`,
      providerSlug, title, cpu, ram, disk, diskType, bandwidth, traffic,
      regions, price, cycle, perMonth, os, tags, url, featured: !!featured
    }
  })
}
