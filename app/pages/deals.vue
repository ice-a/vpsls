<script setup lang="ts">
import type { Availability, Offer } from '#shared/types'

useSeoMeta({
  title: '实时筛选 · VPS 报价单',
  description: '按 CPU、内存、硬盘、带宽、机房、预算实时筛选 VPS，结果按年付总价排序。'
})

const route = useRoute()
const router = useRouter()

const { data: offersRes } = await useFetch('/api/offers')
const { data: providersRes } = await useFetch('/api/providers')

const allOffers = computed<Offer[]>(() => offersRes.value?.offers ?? [])

const providerInfo = computed<Record<string, { name: string; availability: Availability }>>(() => {
  const map: Record<string, { name: string; availability: Availability }> = {}
  for (const p of providersRes.value?.providers ?? []) map[p.slug] = { name: p.name, availability: p.availability }
  return map
})

const regionOptions = computed(() =>
  [...new Set(allOffers.value.flatMap(o => o.regions))].sort()
)

// ---- 筛选状态（初始化读一次 URL query，可分享） ----
// 旧分享链接 window=15/30/50/100/200（月单价口径）自动 ×12 换算成年付口径
const normalizeWindow = (n: number) => ([15, 30, 50, 100, 200].includes(n) ? n * 12 : n)
const q = route.query
const windowCap = ref<number | null>(q.window ? normalizeWindow(Number(q.window)) : null)
const minRam = ref<number>(q.minRam ? Number(q.minRam) : 0)
const minCpu = ref<number>(q.minCpu ? Number(q.minCpu) : 0)
const minDisk = ref<number>(q.minDisk ? Number(q.minDisk) : 0)
const region = ref<string>(typeof q.region === 'string' ? q.region : '')
const os = ref<string>(typeof q.os === 'string' ? q.os : '')
const cycle = ref<string>(typeof q.cycle === 'string' ? q.cycle : '')
const provider = ref<string>(typeof q.provider === 'string' ? q.provider : '')
const keyword = ref<string>(typeof q.q === 'string' ? q.q : '')
const sort = ref<string>(typeof q.sort === 'string' && q.sort ? q.sort : 'recommend')

const windows: Array<number | null> = [null, 180, 360, 600, 1200, 2400]

const results = computed(() => {
  let list = allOffers.value
  if (windowCap.value !== null) list = list.filter(o => o.perYear <= windowCap.value!)
  if (minRam.value) list = list.filter(o => o.ram >= minRam.value)
  if (minCpu.value) list = list.filter(o => o.cpu >= minCpu.value)
  if (minDisk.value) list = list.filter(o => o.disk >= minDisk.value)
  if (region.value) list = list.filter(o => o.regions.includes(region.value))
  if (os.value) list = list.filter(o => o.os === os.value)
  if (cycle.value) list = list.filter(o => o.cycle === cycle.value)
  if (provider.value) list = list.filter(o => o.providerSlug === provider.value)
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      o =>
        o.title.toLowerCase().includes(kw) ||
        (providerInfo.value[o.providerSlug]?.name.toLowerCase().includes(kw) ?? false) ||
        o.tags.some(t => t.toLowerCase().includes(kw))
    )
  }
  const cmp: Record<string, (a: Offer, b: Offer) => number> = {
    recommend: (a, b) =>
      Number(b.hasAff) - Number(a.hasAff) ||
      Number(b.cycle === 'yearly') - Number(a.cycle === 'yearly') ||
      a.perYear - b.perYear,
    perMonth: (a, b) => a.perMonth - b.perMonth,
    perYear: (a, b) => a.perYear - b.perYear,
    price: (a, b) => a.price - b.price,
    ram: (a, b) => b.ram - a.ram,
    cpu: (a, b) => b.cpu - a.cpu,
    disk: (a, b) => b.disk - a.disk,
    bw: (a, b) => b.bandwidth - a.bandwidth
  }
  return [...list].sort(cmp[sort.value] ?? cmp.recommend)
})

// 状态 → URL 同步（可分享的筛选链接）+ 搜索条件上报（去抖）
const activeConditions = () => ({
  window: windowCap.value,
  q: keyword.value || null,
  minCpu: minCpu.value || null,
  minRam: minRam.value || null,
  minDisk: minDisk.value || null,
  region: region.value || null,
  os: os.value || null,
  cycle: cycle.value || null,
  provider: provider.value || null,
  sort: sort.value !== 'recommend' ? sort.value : null
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
const reportSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    $fetch('/api/track/search', { method: 'POST', body: { conditions: activeConditions() } }).catch(() => {})
  }, 800)
}

watch(
  [windowCap, minRam, minCpu, minDisk, region, os, cycle, provider, keyword, sort],
  () => {
    const query: Record<string, string> = {}
    if (windowCap.value !== null) query.window = String(windowCap.value)
    if (minRam.value) query.minRam = String(minRam.value)
    if (minCpu.value) query.minCpu = String(minCpu.value)
    if (minDisk.value) query.minDisk = String(minDisk.value)
    if (region.value) query.region = region.value
    if (os.value) query.os = os.value
    if (cycle.value) query.cycle = cycle.value
    if (provider.value) query.provider = provider.value
    if (keyword.value) query.q = keyword.value
    if (sort.value !== 'recommend') query.sort = sort.value
    router.replace({ query })
    reportSearch()
  }
)

const reset = () => {
  windowCap.value = null
  minRam.value = 0
  minCpu.value = 0
  minDisk.value = 0
  region.value = ''
  os.value = ''
  cycle.value = ''
  provider.value = ''
  keyword.value = ''
  sort.value = 'perMonth'
}

const activeFilters = computed(
  () =>
    (windowCap.value !== null ? 1 : 0) +
    (minRam.value ? 1 : 0) +
    (minCpu.value ? 1 : 0) +
    (minDisk.value ? 1 : 0) +
    (region.value ? 1 : 0) +
    (os.value ? 1 : 0) +
    (cycle.value ? 1 : 0) +
    (provider.value ? 1 : 0) +
    (keyword.value ? 1 : 0)
)
</script>

<template>
  <div>
    <section class="hero" style="padding: 56px 0 36px">
      <div class="wrap">
        <div class="eyebrow">LIVE FILTER · 实时筛选器</div>
        <h1 style="font-size: clamp(30px, 4.5vw, 46px)">按硬件和预算，现场拼你要的那台机</h1>
        <p class="hero-sub">共收录 {{ allOffers.length }} 条套餐，筛选在浏览器里实时完成，价格按年付总价统一口径，链接可直接分享。</p>
      </div>
    </section>

    <section class="section">
      <div class="wrap deals-layout">
        <!-- 筛选栏 -->
        <aside class="filter-rail">
          <div class="rail-head">
            <span>FILTER PANEL</span>
            <button class="chip-btn" type="button" @click="reset">RESET{{ activeFilters ? ` (${activeFilters})` : '' }}</button>
          </div>

          <div class="filter-group">
            <h5>预算窗口 · 年付总价</h5>
            <div class="chip-row">
              <button
                v-for="w in windows"
                :key="String(w)"
                type="button"
                class="chip-btn"
                :class="{ on: windowCap === w }"
                @click="windowCap = w"
              >
                {{ w === null ? '全部' : `≤$${w}/年` }}
              </button>
            </div>
          </div>

          <div class="filter-group">
            <h5>关键词</h5>
            <input v-model="keyword" type="search" placeholder="厂商 / 套餐 / 标签…" />
          </div>

          <div class="filter-group">
            <h5>硬件下限</h5>
            <div style="display: grid; gap: 8px">
              <label class="mono faint" style="font-size: 11px">CPU ≥ {{ minCpu }} vCPU</label>
              <input v-model.number="minCpu" type="range" min="0" max="10" step="1" />
              <label class="mono faint" style="font-size: 11px">RAM ≥ {{ minRam }} GB</label>
              <input v-model.number="minRam" type="range" min="0" max="32" step="1" />
              <label class="mono faint" style="font-size: 11px">DISK ≥ {{ minDisk }} GB</label>
              <input v-model.number="minDisk" type="range" min="0" max="400" step="10" />
            </div>
          </div>

          <div class="filter-group">
            <h5>机房地区</h5>
            <select v-model="region">
              <option value="">全部地区</option>
              <option v-for="r in regionOptions" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>

          <div class="filter-group">
            <h5>系统</h5>
            <div class="chip-row">
              <button type="button" class="chip-btn" :class="{ on: os === '' }" @click="os = ''">全部</button>
              <button type="button" class="chip-btn" :class="{ on: os === 'linux' }" @click="os = 'linux'">Linux</button>
              <button type="button" class="chip-btn" :class="{ on: os === 'windows' }" @click="os = 'windows'">Windows</button>
            </div>
          </div>

          <div class="filter-group">
            <h5>计费周期</h5>
            <select v-model="cycle">
              <option value="">全部</option>
              <option value="monthly">月付</option>
              <option value="quarterly">季付</option>
              <option value="semiannual">半年付</option>
              <option value="yearly">年付</option>
            </select>
          </div>

          <div class="filter-group">
            <h5>服务商</h5>
            <select v-model="provider">
              <option value="">全部厂商</option>
              <option v-for="p in providersRes?.providers ?? []" :key="p.slug" :value="p.slug">{{ p.name }}</option>
            </select>
          </div>
        </aside>

        <!-- 结果 -->
        <div>
          <div class="results-bar">
            <span>命中</span>
            <span class="count">{{ results.length }}</span>
            <span>条 / 共 {{ allOffers.length }} 条</span>
            <span class="spacer" />
            <span>SORT</span>
            <select v-model="sort" class="mono" style="background: var(--panel); border: 1px solid var(--line-strong); color: var(--ink); padding: 6px 10px">
              <option value="recommend">综合推荐（年付优先）</option>
              <option value="perYear">年付总价 ↑</option>
              <option value="perMonth">月单价 ↑</option>
              <option value="price">标价 ↑</option>
              <option value="cpu">CPU ↓</option>
              <option value="ram">内存 ↓</option>
              <option value="disk">硬盘 ↓</option>
              <option value="bw">带宽 ↓</option>
            </select>
          </div>

          <OfferSheet :offers="results" :provider-info="providerInfo" src="deals" />

          <div v-if="results.length" class="mono faint" style="font-size: 11px; margin-top: 12px; text-align: right">
            SHOWING {{ results.length }} / {{ allOffers.length }} · 全部链接经 /go/ 出口替换推广参数
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
