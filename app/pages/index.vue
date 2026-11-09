<script setup lang="ts">
import type { Availability, Offer } from '#shared/types'

useSeoMeta({
  title: 'VPS 报价单 · 全网 VPS 每日核价 · 人民币实时换算 · 机房测速选购',
  description: '全网 VPS 套餐按年付总价统一排序，美元标价实时汇率折算人民币；机房连通性每日 04:00 自动检测，支持按你的网络位置测速推荐机房区域。'
})

const { data: home } = await useFetch('/api/home')

const stats = computed(() => home.value?.stats)
const cheapest = computed<Offer[]>(() => home.value?.cheapest ?? [])
const featured = computed<Offer[]>(() => home.value?.featured ?? [])

/** 厂商查表：给 OfferSheet 的 name/status 用 */
const providerInfo = computed<Record<string, { name: string; availability: Availability }>>(() => {
  const map: Record<string, { name: string; availability: Availability }> = {}
  for (const p of home.value?.providers ?? []) map[p.slug] = { name: p.name, availability: p.availability }
  return map
})
const topProviders = computed(() =>
  [...(home.value?.providers ?? [])]
    .sort((a, b) => b.offerCount - a.offerCount)
    .slice(0, 8)
)

const providerRows = computed(() =>
  topProviders.value.map(p => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    regions: p.regions,
    availability: p.availability,
    lastCheckedAt: home.value?.stats.updatedAt ?? null,
    failStreak: 0,
    offerCount: p.offerCount,
    cheapestPerMonth: p.cheapestPerMonth
  }))
)

const windows = [
  { cap: 180, label: '超值选择' },
  { cap: 360, label: '经济实惠' },
  { cap: 600, label: '中端配置' },
  { cap: 1200, label: '高端性能' },
  { cap: 2400, label: '旗舰配置' }
]

const fmtDate = (iso: string) => iso.slice(0, 10)
const { fmtPrice, fmtWindow, fmtYear } = useFx()
const official = computed(() => home.value?.official ?? null)
</script>

<template>
  <div>
    <!-- HERO -->
    <section class="hero">
      <div class="wrap">
        <div class="eyebrow">VPS PRICE SHEET · 每日核价 · 实时汇率</div>
        <h1>
          全网 VPS 报价，按<span class="hl">年付总价</span>排成<span class="hl">一张表</span>
        </h1>
        <p class="hero-sub">
          {{ stats?.offerCount ?? '—' }} 条套餐、{{ stats?.providerCount ?? '—' }} 家服务商：其中 {{ official?.offerCount ?? 0 }} 条从厂商官网实时抓取（带「官方实时」标，每日刷新），其余为内置参考价；美元标价按实时汇率折算人民币，年付月付统一口径；机房连通性每日 04:00 自动检测，先看状态灯再点购买。
        </p>

        <div class="stat-strip">
          <div class="stat-cell accent">
            <div class="k">Offers 收录</div>
            <div class="v">{{ stats?.offerCount ?? '—' }}<span class="unit">条</span></div>
          </div>
          <div class="stat-cell">
            <div class="k">Providers 服务商</div>
            <div class="v">{{ stats?.providerCount ?? '—' }}<span class="unit">家</span></div>
          </div>
          <div class="stat-cell">
            <div class="k">Regions 机房地区</div>
            <div class="v">{{ stats?.regionCount ?? '—' }}<span class="unit">个</span></div>
          </div>
          <div class="stat-cell">
            <div class="k">Last Check 最近检测</div>
            <div class="v" style="font-size: 20px">{{ stats ? fmtDate(stats.updatedAt) : '—' }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 预算窗口 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">01</span>
          <h2>按预算快选</h2>
          <span class="desc">YEARLY TOTAL USD</span>
        </div>
        <div class="window-grid">
          <NuxtLink v-for="w in windows" :key="w.cap" class="window-card" :to="`/deals?window=${w.cap}`">
            <div class="price-cap"><small>≤ </small>{{ fmtWindow(w.cap).main }}<small>/年</small></div>
            <div class="cap-label">{{ w.label }}<span class="mono faint" v-if="fmtWindow(w.cap).sub" style="margin-left: 6px">≈{{ fmtWindow(w.cap).sub }}/年</span></div>
            <div class="go mono">VIEW PACKAGES →</div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- 最便宜榜 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">02</span>
          <h2>最值得买的年付套餐</h2>
          <span class="desc">YEARLY PICKS · BY PRICE ↑</span>
        </div>
        <p class="mono faint" style="font-size: 12px; margin-top: -14px; margin-bottom: 14px">
          只列年付套餐 · 按年付总价升序 · 价格口径全站统一
        </p>
        <OfferSheet :offers="cheapest" :provider-info="providerInfo" src="home-cheapest" />
      </div>
    </section>

    <!-- 推荐位 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">03</span>
          <h2>编辑推荐</h2>
          <span class="desc">HAND-PICKED · {{ featured.length }} ITEMS</span>
        </div>
        <div class="feature-grid">
          <article v-for="o in featured" :key="o.id" class="feature-card">
            <i class="corner" />
            <div class="fc-head">
              <div>
                <div class="fc-name">{{ providerInfo[o.providerSlug]?.name ?? o.providerSlug }}</div>
                <div class="fc-title">{{ o.title }}</div>
              </div>
              <StatusChip :availability="providerInfo[o.providerSlug]?.availability ?? 'unknown'" compact />
            </div>
            <div class="fc-spec">
              <div><b>{{ o.cpu }}</b><span>VCPU</span></div>
              <div><b>{{ o.ram }}G</b><span>RAM</span></div>
              <div><b>{{ o.disk }}G</b><span>{{ o.diskType }}</span></div>
            </div>
            <div class="tag-row">
              <span v-if="o.cycle === 'yearly'" class="tag yearly-tag">年付</span>
              <span v-for="t in o.tags" :key="t" class="tag" :class="{ hot: t.includes('神价') || t.includes('CN2 GIA') }">{{ t }}</span>
              <span class="tag">{{ o.regions.join('/') }}</span>
            </div>
            <div class="fc-foot">
              <div class="price-cell">
                <span class="per">{{ fmtYear(o.perYear, o.perMonth).yearMain }}</span>
                <span class="cycle">{{ fmtYear(o.perYear, o.perMonth).monthMain }}<template v-if="fmtYear(o.perYear, o.perMonth).yearSub"> · {{ fmtYear(o.perYear, o.perMonth).yearSub }}</template></span>
              </div>
              <NuxtLink class="btn btn-primary btn-sm" :to="`/go/${o.providerSlug}?offer=${o.id}&src=home-feature`" rel="sponsored noopener">
                查看
              </NuxtLink>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 服务商状态 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">04</span>
          <h2>服务商状态速览</h2>
          <span class="desc">DAILY PROBE · TOP 8 BY OFFERS</span>
        </div>
        <ProviderSheet :providers="providerRows" src="home-providers" />
        <div style="margin-top: 16px; text-align: right">
          <NuxtLink class="btn btn-sm" to="/providers">查看全部服务商 →</NuxtLink>
        </div>
      </div>
    </section>

    <!-- 选购要点 -->
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">05</span>
          <h2>选购要点</h2>
          <span class="desc">BUYING CHECKLIST</span>
        </div>
        <div class="prose-grid">
          <div class="prose-card">
            <h3>先看年付总价，再看配置</h3>
            <p>$12/年 和 $5/月 不是一个量级的生意。本表所有价格统一折算成「一年总共花多少」，月付年付同一把尺子比，再按实时汇率标人民币。</p>
          </div>
          <div class="prose-card">
            <h3>线路比配置更影响体感</h3>
            <p>回国线路 CN2 GIA / 软银 / BGP 的差异，比多 1 核 CPU 明显得多。亚洲机房低延迟，美西性价比高，按用途选。</p>
          </div>
          <div class="prose-card clay">
            <h3>购买前确认可用性</h3>
            <p>本站每日 04:00 自动探测各服务商官网，连续 3 轮失败会打上「不可达」标。点了打不开的锅，状态灯先替你背。</p>
          </div>
          <div class="prose-card clay">
            <h3>月付党和年付党各走各路</h3>
            <p>想随时跑路选月付，接受预付就找年付神价。计费口径列写得明明白白，别被「$10 起」晃了眼。</p>
          </div>
        </div>

        <div class="cta-strip" style="margin-top: 32px">
          <div>
            <h3>不知道选哪个区域？先测速，再选购</h3>
            <p>识别你当前 IP 所在位置推荐机房区域，也可以手动选点实测延迟——最快区域的套餐一键直达。</p>
          </div>
          <NuxtLink class="btn btn-primary" to="/guide">打开测速选购方法 →</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
