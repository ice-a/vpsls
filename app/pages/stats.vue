<script setup lang="ts">
useSeoMeta({
  title: '访问统计 · VPS 报价单',
  description: '每日页面打开次数、产品点击（出口跳转）与搜索条件统计。'
})

interface StatsResp {
  days: string[]
  daily: Array<{ date: string; views: number; clicks: number; searches: number }>
  topPages: Array<{ path: string; count: number }>
  topClicks: Array<{ key: string; count: number }>
  topSearches: Array<{ condition: string; count: number }>
  totals: { views: number; clicks: number; searches: number }
}

const range = ref(14)
const { data, refresh } = await useFetch<StatsResp>('/api/stats', { query: { days: range } })
watch(range, () => refresh())

const stats = computed(() => data.value)
const maxViews = computed(() => Math.max(1, ...(stats.value?.daily.map(d => d.views) ?? [1])))

/** 点击 key → 人类可读标签 */
const { data: offersRes } = await useFetch('/api/offers')
const labelOf = (key: string) => {
  if (!key.startsWith('provider:')) {
    const o = offersRes.value?.offers.find(x => x.id === key)
    if (o) return { main: `${o.title}`, sub: `${o.providerSlug} · ${o.id}` }
    return { main: key, sub: 'offer' }
  }
  const slug = key.slice('provider:'.length)
  return { main: slug, sub: '厂商直达' }
}
</script>

<template>
  <div>
    <section class="hero" style="padding: 56px 0 36px">
      <div class="wrap">
        <div class="eyebrow">ANALYTICS · 访问统计</div>
        <h1 style="font-size: clamp(30px, 4.5vw, 46px)">谁在看、点了谁、搜了什么</h1>
        <p class="hero-sub">
          每日页面打开次数、产品级出口点击、搜索条件 Top 榜。数据落 <span class="mono">.data/analytics.json</span>，本地自持不外传。
        </p>

        <div class="prov-head" style="margin-top: 24px">
          <button
            v-for="d in [7, 14, 30, 90]"
            :key="d"
            class="chip-btn"
            :class="{ on: range === d }"
            type="button"
            @click="range = d"
          >
            近 {{ d }} 天
          </button>
          <button class="btn btn-sm" type="button" @click="refresh()">↻ 刷新</button>
        </div>

        <div class="stat-strip" v-if="stats">
          <div class="stat-cell accent">
            <div class="k">Page Views 页面打开</div>
            <div class="v">{{ stats.totals.views }}</div>
          </div>
          <div class="stat-cell">
            <div class="k">Out Clicks 出口点击</div>
            <div class="v">{{ stats.totals.clicks }}</div>
          </div>
          <div class="stat-cell">
            <div class="k">Searches 搜索次数</div>
            <div class="v">{{ stats.totals.searches }}</div>
          </div>
          <div class="stat-cell">
            <div class="k">CTR 点击率</div>
            <div class="v">
              {{ stats.totals.views ? ((stats.totals.clicks / stats.totals.views) * 100).toFixed(1) : '0.0' }}
              <span class="unit">%</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 每日趋势 -->
    <section class="section" v-if="stats">
      <div class="wrap">
        <div class="section-head">
          <span class="index">01</span>
          <h2>每日趋势</h2>
          <span class="desc">VIEWS / CLICKS / SEARCHES PER DAY</span>
        </div>

        <div class="sheet" style="padding: 24px 20px 12px">
          <div style="display: flex; align-items: flex-end; gap: 6px; height: 200px">
            <div
              v-for="d in stats.daily"
              :key="d.date"
              style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 3px; min-width: 0"
              :title="`${d.date} · PV ${d.views} / 点击 ${d.clicks} / 搜索 ${d.searches}`"
            >
              <i
                style="display: block; background: var(--accent); min-height: 2px"
                :style="{ height: `${(d.views / maxViews) * 160}px` }"
              />
              <i
                style="display: block; background: var(--accent-clay); min-height: 1px"
                :style="{ height: `${Math.min(d.clicks * 4, 32)}px` }"
              />
            </div>
          </div>
          <div style="display: flex; gap: 6px; border-top: 1px solid var(--line); padding-top: 8px; margin-top: 8px">
            <div
              v-for="d in stats.daily"
              :key="d.date"
              class="mono faint"
              style="flex: 1; font-size: 9px; text-align: center; overflow: hidden"
            >
              {{ d.date.slice(5) }}
            </div>
          </div>
          <div class="mono faint" style="font-size: 11px; margin-top: 10px; display: flex; gap: 18px">
            <span><i style="display: inline-block; width: 10px; height: 10px; background: var(--accent)" /> PV</span>
            <span><i style="display: inline-block; width: 10px; height: 10px; background: var(--accent-clay)" /> 出口点击</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 三榜 -->
    <section class="section" v-if="stats">
      <div class="wrap" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px">
        <!-- 页面榜 -->
        <div>
          <div class="section-head">
            <span class="index">02</span>
            <h2 style="font-size: 18px">页面打开 Top</h2>
          </div>
          <div class="sheet">
            <table style="min-width: 0">
              <thead><tr><th>路径</th><th style="text-align: right">次数</th></tr></thead>
              <tbody>
                <tr v-for="p in stats.topPages" :key="p.path">
                  <td class="mono" style="font-size: 12px">{{ p.path }}</td>
                  <td class="num" style="text-align: right">{{ p.count }}</td>
                </tr>
                <tr v-if="!stats.topPages.length"><td colspan="2" class="faint">暂无数据</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 产品点击榜 -->
        <div>
          <div class="section-head">
            <span class="index">03</span>
            <h2 style="font-size: 18px">产品点击 Top</h2>
          </div>
          <div class="sheet">
            <table style="min-width: 0">
              <thead><tr><th>对象</th><th style="text-align: right">次数</th></tr></thead>
              <tbody>
                <tr v-for="c in stats.topClicks" :key="c.key">
                  <td>
                    <span class="p-name" style="font-size: 13px">{{ labelOf(c.key).main }}</span>
                    <span class="p-tag mono">{{ labelOf(c.key).sub }}</span>
                  </td>
                  <td class="num" style="text-align: right">{{ c.count }}</td>
                </tr>
                <tr v-if="!stats.topClicks.length"><td colspan="2" class="faint">暂无数据</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 搜索条件榜 -->
        <div>
          <div class="section-head">
            <span class="index">04</span>
            <h2 style="font-size: 18px">搜索条件 Top</h2>
          </div>
          <div class="sheet">
            <table style="min-width: 0">
              <thead><tr><th>条件</th><th style="text-align: right">次数</th></tr></thead>
              <tbody>
                <tr v-for="s in stats.topSearches" :key="s.condition">
                  <td class="mono" style="font-size: 11px; word-break: break-all">{{ s.condition }}</td>
                  <td class="num" style="text-align: right">{{ s.count }}</td>
                </tr>
                <tr v-if="!stats.topSearches.length"><td colspan="2" class="faint">暂无数据（去筛选器里筛几下）</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
