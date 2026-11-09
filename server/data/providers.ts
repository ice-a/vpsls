import type { Provider } from '#shared/types'

/**
 * 服务商种子数据（目录部分）。availability / lastCheckedAt / failStreak
 * 运行时由 .data/state.json 覆盖写入，这里只给初始值。
 * url = 官网首页，aff 替换逻辑见 shared/aff.ts。
 */
export const SEED_PROVIDERS: Provider[] = [
  { slug: 'racknerd', name: 'RackNerd', tagline: '美西低价年付常年有货', regions: ['US-WEST', 'US-EAST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://racknerd.com' },
  { slug: 'vultr', name: 'Vultr', tagline: '全球机房按小时计费', regions: ['US-EAST', 'EU', 'ASIA'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://www.vultr.com' },
  { slug: 'digitalocean', name: 'DigitalOcean', tagline: '开发者友好带快照', regions: ['US-EAST', 'EU'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://www.digitalocean.com' },
  { slug: 'linode', name: 'Linode', tagline: 'Akamai 旗下老牌商家', regions: ['US-EAST', 'EU', 'ASIA'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://www.linode.com' },
  { slug: 'hetzner', name: 'Hetzner', tagline: '德国裸价性能猛兽', regions: ['EU'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://www.hetzner.com' },
  { slug: 'ovhcloud', name: 'OVHcloud', tagline: '法国大厂防 DDoS 出名', regions: ['EU', 'US-EAST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://www.ovhcloud.com' },
  { slug: 'contabo', name: 'Contabo', tagline: '大硬盘便宜的德国商家', regions: ['EU', 'US-EAST', 'ASIA'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://contabo.com' },
  { slug: 'bandwagon', name: '搬瓦工', tagline: 'CN2 GIA 线路标杆', regions: ['US-WEST', 'ASIA'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://bwh81.net' },
  { slug: 'vmiss', name: 'VMISS', tagline: '亚洲优化线路老商家', regions: ['ASIA', 'US-WEST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://vmiss.com' },
  { slug: 'zgovps', name: 'ZgoVPS', tagline: '洛杉矶 CN2 GIA 高配', regions: ['US-WEST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://zgovps.com' },
  { slug: 'dogyun', name: 'Dogyun', tagline: '港日机房网络稳', regions: ['ASIA'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://www.dogyun.com' },
  { slug: 'justhost', name: 'JustHost', tagline: '俄罗斯多机房白菜价', regions: ['RU', 'EU'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://justhost.ru' },
  { slug: 'colocrossing', name: 'ColoCrossing', tagline: '美东经济型老牌机房', regions: ['US-EAST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://colocrossing.com' },
  { slug: 'bytevirt', name: 'Bytevirt', tagline: '小众精品多地区', regions: ['ASIA', 'US-WEST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://bytevirt.com' },
  { slug: 'wapac', name: 'WAP.AC', tagline: '台湾机房超低年付', regions: ['ASIA'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://wap.ac' },
  { slug: 'dedione', name: 'DediOne', tagline: '密苏里大容量 NVMe', regions: ['US-EAST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://dedione.com' },
  { slug: 'cloudserver', name: 'CloudServer', tagline: '多机房入门年付', regions: ['US-WEST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://cloudserver.com' },
  { slug: 'hosthatch', name: 'HostHatch', tagline: '欧洲大硬盘便宜货', regions: ['EU', 'US-EAST'], availability: 'unknown', lastCheckedAt: null, failStreak: 0, url: 'https://hosthatch.com' }
]
