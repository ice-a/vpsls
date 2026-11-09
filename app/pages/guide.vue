<script setup lang="ts">
/**
 * 选购方法 / 测速页
 *  - 自动：取当前公网 IP 所在位置（ipwho.is → ipinfo.io），映射推荐机房区域，并对该区域实测
 *  - 手动：点任意区域发起浏览器端延迟实测（no-cors fetch 计时，取多目标最小值，约等于 RTT）
 *  - 结果按耗时排序，最快区域一键跳筛选器
 */
useSeoMeta({
  title: '选购方法 · 按你的网络位置测速选机房',
  description: '检测你当前 IP 所在位置，推荐延迟更低的 VPS 机房区域；也可手动选择地点实测延迟，最快区域一键直达筛选器。'
})

interface RegionDef {
  code: string
  label: string
  offerRegion: string
  targets: string[]
  note: string
}

const REGIONS: RegionDef[] = [
  { code: 'ASIA-HK', label: '香港 Hong Kong', offerRegion: 'ASIA', targets: ['https://www.hkix.net', 'https://www.etnet.com.hk', 'https://www.gov.hk'], note: 'CN2 / 直连线路多，低延迟首选' },
  { code: 'ASIA-JP', label: '日本 Japan', offerRegion: 'ASIA', targets: ['https://www.nic.ad.jp', 'https://www.iij.ad.jp', 'https://www.jprs.co.jp'], note: '软银 / CMI 线路，晚高峰表现稳' },
  { code: 'ASIA-SG', label: '新加坡 Singapore', offerRegion: 'ASIA', targets: ['https://www.sgix.sg', 'https://www.sgx.com'], note: '东南亚业务落地首选' },
  { code: 'ASIA-TW', label: '台湾 Taiwan', offerRegion: 'ASIA', targets: ['https://www.hinet.net', 'https://www.tpix.com.tw', 'https://www.twnic.tw'], note: 'HiNet/CN2 台湾，延迟接近香港' },
  { code: 'ASIA-KR', label: '韩国 Korea', offerRegion: 'ASIA', targets: ['https://www.nic.or.kr'], note: 'BGP 优化，游戏 / 直播可用' },
  { code: 'US-WEST', label: '美国西部 US-West', offerRegion: 'US-WEST', targets: ['https://www.sfmix.org', 'https://www.uci.edu'], note: 'CN2 GIA 主战场，综合性价比最高' },
  { code: 'US-EAST', label: '美国东部 US-East', offerRegion: 'US-EAST', targets: ['https://www.nyix.net', 'https://www.columbia.edu'], note: '延迟比美西高约 60ms，价格更低' },
  { code: 'EU', label: '欧洲 Europe', offerRegion: 'EU', targets: ['https://www.de-cix.net', 'https://www.ams-ix.net'], note: 'Hetzner/OVH 等裸价猛兽聚集地' },
  { code: 'RU', label: '俄罗斯 Russia', offerRegion: 'RU', targets: ['https://www.msk-ix.ru'], note: '白菜价大硬盘，轻量用途合适' }
]

// ---------- IP 定位 ----------
interface Geo { cc: string; city: string; region: string; ip?: string }
const geo = ref<Geo | null>(null)
const geoState = ref<'idle' | 'loading' | 'done' | 'fail'>('idle')

const locate = async () => {
  geoState.value = 'loading'
  for (const url of ['https://ipwho.is/', 'https://ipinfo.io/json']) {
    try {
      const j = await (await fetch(url, { signal: AbortSignal.timeout(6000) })).json()
      const cc = j?.country_code || j?.country || ''
      if (cc) {
        geo.value = { cc, city: j?.city || '', region: j?.region || '', ip: j?.ip }
        geoState.value = 'done'
        return
      }
    } catch { /* 换下一个源 */ }
  }
  geoState.value = 'fail'
}

// ---------- 区域推荐 ----------
const GEO_MAP: Record<string, string> = {
  CN: 'ASIA-HK', HK: 'ASIA-HK', MO: 'ASIA-HK', TW: 'ASIA-TW',
  JP: 'ASIA-JP', KR: 'ASIA-KR', SG: 'ASIA-SG',
  MY: 'ASIA-SG', TH: 'ASIA-SG', VN: 'ASIA-SG', PH: 'ASIA-SG', ID: 'ASIA-SG',
  US: 'US-WEST', CA: 'US-WEST', MX: 'US-WEST',
  RU: 'RU', BY: 'RU', KZ: 'RU',
  GB: 'EU', DE: 'EU', FR: 'EU', NL: 'EU', FI: 'EU', SE: 'EU', PL: 'EU', UA: 'EU', RO: 'EU', IT: 'EU', ES: 'EU'
}
const CN_PROVINCE_NOTE = ['广东', '福建', '上海', '北京', '浙江']

const recommended = computed<RegionDef | null>(() => {
  if (!geo.value?.cc) return null
  const code = GEO_MAP[geo.value.cc]
  if (!code) return null
  return REGIONS.find(r => r.code === code) ?? null
})

const geoReason = computed(() => {
  if (!geo.value || !recommended.value) return ''
  const g = geo.value
  if (g.cc === 'CN') {
    const south = CN_PROVINCE_NOTE.some(p => (g.region + g.city).includes(p.slice(0, 2)))
    return `你在${g.city || '中国大陆'}（${g.cc}）—— 优先选${recommended.value.label}：${recommended.value.note}${south ? '；华南/华东到香港通常 30-50ms' : ''}。`
  }
  return `你的出口 IP 在 ${[g.city, g.region, g.cc].filter(Boolean).join(', ')} —— ${recommended.value.label} 网络距离最近：${recommended.value.note}。`
})

// ---------- 测速 ----------
interface RegionResult { ms: number | null; okCount: number; total: number; testing: boolean }
const results = reactive<Record<string, RegionResult>>({})
const testingCode = ref<string | null>(null)
const started = ref(false)

const probe = (url: string, timeout = 4500): Promise<number | null> =>
  new Promise(resolve => {
    const ctrl = new AbortController()
    const t0 = performance.now()
    const timer = setTimeout(() => {
      ctrl.abort()
      resolve(null)
    }, timeout)
    fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
      .then(() => {
        clearTimeout(timer)
        resolve(Math.round(performance.now() - t0))
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(null)
      })
  })

const testRegion = async (r: RegionDef) => {
  results[r.code] = { ms: null, okCount: 0, total: r.targets.length, testing: true }
  const times: number[] = []
  await Promise.all(
    r.targets.map(async u => {
      const ms = await probe(u)
      if (ms !== null) times.push(ms)
    })
  )
  results[r.code] = {
    ms: times.length ? Math.min(...times) : null,
    okCount: times.length,
    total: r.targets.length,
    testing: false
  }
}

/** 全测 or 只测单个；sequential 限流防把浏览器连接池打爆 */
const testAll = async (only?: RegionDef) => {
  if (testingCode.value) return
  started.value = true
  const list = only ? [only] : REGIONS
  for (const r of list) {
    testingCode.value = r.code
    await testRegion(r)
  }
  testingCode.value = null
}

const rank = computed(() => {
  const ok = REGIONS.filter(r => results[r.code]?.ms != null)
  return [...ok].sort((a, b) => (results[a.code].ms ?? 1e9) - (results[b.code].ms ?? 1e9))
})
const best = computed<RegionDef | null>(() => rank.value[0] ?? null)
const doneRegions = computed(() => REGIONS.filter(r => results[r.code] && !results[r.code].testing).length)

const verdict = (ms: number | null): { text: string; cls: 'up' | 'down' | 'unknown' } => {
  if (ms == null) return { text: '超时/不可达', cls: 'down' }
  if (ms <= 150) return { text: '极快', cls: 'up' }
  if (ms <= 300) return { text: '快', cls: 'up' }
  if (ms <= 500) return { text: '一般', cls: 'unknown' }
  return { text: '偏慢', cls: 'down' }
}
const barPct = (ms: number | null) => (ms == null ? 100 : Math.min(100, Math.max(6, (ms / 800) * 100)))

// ---------- 手动选点 ----------
const manualCode = ref<string>('')
const manualTarget = computed(() => REGIONS.find(r => r.code === manualCode.value) ?? null)
const runManual = () => {
  if (manualTarget.value) testAll(manualTarget.value)
}

// 定位成功 → 自动补测推荐区域（出「结合 IP 的推荐」）
const autoFlow = async () => {
  await locate()
  if (recommended.value) await testAll(recommended.value)
}
</script>

<template>
  <div>
    <!-- HERO -->
    <section class="hero" style="padding: 56px 0 40px">
      <div class="wrap">
        <div class="eyebrow">BUYING GUIDE · 选购方法</div>
        <h1 style="font-size: clamp(30px, 4.5vw, 46px)">先测你到哪个机房快，<br />再决定把钱花在哪</h1>
        <p class="hero-sub">
          同一条配置，机房选错延迟差三倍。这里做两件事：识别你当前 IP 所在位置给出区域推荐；或由你手动选点，浏览器直接实测到各机房区域的网络耗时（取多目标最小值，约等于往返延迟）。
        </p>
        <div class="prov-head" style="margin-top: 26px">
          <button class="btn btn-primary" type="button" :disabled="geoState === 'loading' || !!testingCode" @click="autoFlow">
            {{ geoState === 'loading' ? '定位中…' : testingCode ? '测试中…' : '🎯 一键测速（定位 + 推荐区域实测）' }}
          </button>
          <span class="mono muted" style="font-size: 12px" v-if="started">已测 {{ doneRegions }}/{{ REGIONS.length }} 区域</span>
        </div>
      </div>
    </section>

    <!-- 01 位置与推荐 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">01</span>
          <h2>你的位置 → 推荐区域</h2>
          <span class="desc">IP GEO → REGION</span>
        </div>

        <div class="prose-grid">
          <div class="prose-card" :class="{ clay: geoState === 'fail' }">
            <h3>
              <template v-if="geoState === 'idle'">尚未定位</template>
              <template v-else-if="geoState === 'loading'">正在查询公网 IP 位置…</template>
              <template v-else-if="geoState === 'fail'">定位失败（网络拦了查询接口）</template>
              <template v-else>当前出口 IP：{{ [geo?.city, geo?.region].filter(Boolean).join(' · ') || geo?.cc }}（{{ geo?.cc }}）</template>
            </h3>
            <p v-if="geoState !== 'done' && geoState !== 'fail'">点击上方按钮，查询你的公网出口位置（ipwho.is / ipinfo.io），仅用于本页推荐。</p>
            <p v-else-if="geoState === 'fail'">可直接用下方「手动选点」测速，效果一样。</p>
            <p v-else>{{ geoReason }}</p>
          </div>

          <div class="prose-card" v-if="recommended">
            <h3>建议优先看：{{ recommended.label }} 的套餐</h3>
            <p>
              {{ recommended.note }}。
              <NuxtLink class="mono" style="color: var(--accent)" :to="`/deals?region=${recommended.offerRegion}`">
                → 直达该区域套餐列表
              </NuxtLink>
            </p>
          </div>
          <div class="prose-card" v-else-if="geoState === 'done'">
            <h3>未命中内置映射，用实测说话</h3>
            <p>你的地区不在预设映射里——跑一轮全区域测速，选最快的那批看套餐。</p>
          </div>
        </div>

        <!-- 全区域实测结果 -->
        <div class="sheet" style="margin-top: 24px" v-if="started">
          <table style="min-width: 0">
            <thead>
              <tr>
                <th>机房区域</th>
                <th>实测耗时</th>
                <th>相对进度</th>
                <th>结论</th>
                <th>去看套餐</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in REGIONS" :key="r.code">
                <td>
                  <span class="p-name">{{ r.label }}</span>
                  <span class="p-tag mono">{{ r.code }}</span>
                </td>
                <td class="num">
                  <template v-if="!results[r.code]"><span class="faint">未测</span></template>
                  <template v-else-if="results[r.code].testing"><span class="mono" style="color: var(--accent-amber)">测试中…</span></template>
                  <template v-else-if="results[r.code].ms != null">
                    <span class="price-cell"><span class="per">{{ results[r.code].ms }}ms</span></span>
                    <span class="cycle">{{ results[r.code].okCount }}/{{ results[r.code].total }} 目标可达</span>
                  </template>
                  <template v-else><span class="faint">全部超时</span></template>
                </td>
                <td style="min-width: 160px">
                  <i
                    style="display: block; height: 8px; background: var(--accent)"
                    :style="{
                      width: results[r.code]?.ms != null ? `${barPct(results[r.code].ms)}%` : '0%',
                      opacity: results[r.code]?.ms != null ? 1 : 0,
                      transition: 'width .5s ease'
                    }"
                  />
                  <span class="mono faint" style="font-size: 10px">0 — 800ms 参考尺</span>
                </td>
                <td>
                  <StatusChip
                    v-if="results[r.code] && !results[r.code].testing"
                    :availability="verdict(results[r.code].ms).cls"
                    compact
                  />
                  <span class="mono faint" v-else>—</span>
                  <span
                    v-if="results[r.code] && !results[r.code].testing && best?.code === r.code"
                    class="tag hot"
                    style="margin-left: 6px"
                  >最快</span>
                </td>
                <td>
                  <NuxtLink class="btn btn-sm" :to="`/deals?region=${r.offerRegion}`">筛选 →</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mono faint" style="font-size: 11px; margin-top: 10px" v-if="started">
          * 测量方式：浏览器对各区域 2-3 个本地站点发起无跨域读取请求并计时（响应头到达即停），取最小值 ≈ RTT；受本地网络抖动影响，横向比较有参考价值，绝对值不必较真。目标站点不可达记为超时，不影响其它区域。
        </p>
      </div>
    </section>

    <!-- 02 手动选点 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">02</span>
          <h2>手动选点测速</h2>
          <span class="desc">PICK A REGION · TEST</span>
        </div>

        <div class="filter-rail" style="position: static">
          <div class="filter-group">
            <h5>选择要测试的地点</h5>
            <div class="chip-row">
              <button
                v-for="r in REGIONS"
                :key="r.code"
                type="button"
                class="chip-btn"
                :class="{ on: manualCode === r.code }"
                :disabled="!!testingCode"
                @click="manualCode = r.code"
              >
                {{ r.label }}
              </button>
            </div>
          </div>
          <div class="filter-group" style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap">
            <button class="btn btn-primary" type="button" :disabled="!manualTarget || !!testingCode" @click="runManual">
              ⚡ 开始测试
            </button>
            <button class="btn" type="button" :disabled="!!testingCode" @click="testAll()">
              全部区域测一轮
            </button>
            <span class="mono muted" style="font-size: 12px" v-if="manualTarget">
              目标：{{ manualTarget.label }} · {{ manualTarget.targets.length }} 个探测点 · {{ manualTarget.note }}
            </span>
            <span class="mono" style="font-size: 13px; color: var(--accent)" v-if="manualTarget && results[manualTarget.code]?.ms != null">
              → {{ manualTarget.label }} 实测 {{ results[manualTarget.code].ms }}ms（{{ verdict(results[manualTarget.code].ms).text }}）
            </span>
          </div>
        </div>

        <div class="cta-strip" style="margin-top: 28px" v-if="best">
          <div>
            <h3>当前网络下最快：{{ best.label }}（{{ results[best.code].ms }}ms）</h3>
            <p>{{ best.note }}。区域对了，再回筛选器按预算和配置挑具体套餐。</p>
          </div>
          <NuxtLink class="btn btn-primary" :to="`/deals?region=${best.offerRegion}`">看这个区域的套餐 →</NuxtLink>
        </div>
      </div>
    </section>

    <!-- 03 方法论 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">03</span>
          <h2>四步选购法</h2>
          <span class="desc">HOW TO PICK</span>
        </div>
        <div class="prose-grid">
          <div class="prose-card">
            <h3>① 先定预算口径：看年付总价</h3>
            <p>$12/年 和 $5/月 不是一回事。本站所有价格统一折算成「一年总共花多少」再排序，再按实时汇率标人民币，月付年付同一把尺子比。</p>
          </div>
          <div class="prose-card">
            <h3>② 定区域：测速 > 听评测</h3>
            <p>用上面的工具测你自己的网络到哪个区域快。国内用户一般顺序：香港/台湾 → 日本/韩国 → 美西 CN2 GIA → 新加坡，欧洲适合不敏感的后台业务。</p>
          </div>
          <div class="prose-card clay">
            <h3>③ 看线路，不只看配置</h3>
            <p>同为 2C4G，CN2 GIA 和普通 163 的晚高峰体验差一个量级。建站/开发看带宽流量，回国访问看线路（CN2 GIA / 软银 / BGP 优化）。</p>
          </div>
          <div class="prose-card clay">
            <h3>④ 确认可用性再付钱</h3>
            <p>下单前回服务商页看状态灯：本站每日 04:00 自动探测官网连通性，连续 3 轮失败会打「不可达」标。月付党想灵活选月付，薅年付价的看年付神价。</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
