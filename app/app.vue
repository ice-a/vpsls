<script setup lang="ts">
const route = useRoute()
const { data: home } = await useFetch('/api/home')
const { data: rates } = await useFetch('/api/rates')

// 汇率注入全局货币层（SSR 渲染前完成，避免水合闪烁）
const { setFxRates, currency, toggle, rateLabel } = useFx()
setFxRates(rates.value as any)
// 客户端挂载后再读本地偏好（默认 CNY 先渲染，避免 hydration mismatch）
onMounted(() => {
  try {
    const saved = localStorage.getItem('vpshunt:currency')
    if (saved === 'USD' || saved === 'CNY') toggle(saved)
  } catch { /* ignore */ }
})

useHead({
  bodyAttrs: { class: 'site-body' }
})

// 导航高亮
const isActive = (path: string) => route.path === path

// 页脚状态条
const lastRun = computed(() => home.value?.lastRun ?? null)
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <div class="wrap header-inner">
        <NuxtLink to="/" class="brand" aria-label="VPS 报价单首页">
          <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="11" y="11" width="10" height="10" fill="var(--accent-clay)" />
            <g stroke="var(--accent)" stroke-width="2" fill="none">
              <path d="M16 3v7M16 22v7M3 16h7M22 16h7" />
            </g>
          </svg>
          <span class="brand-word">VPS<em>报价单</em></span>
        </NuxtLink>

        <nav class="site-nav">
          <NuxtLink to="/" class="nav-link" :class="{ on: isActive('/') }">首页</NuxtLink>
          <NuxtLink to="/deals" class="nav-link" :class="{ on: isActive('/deals') }">实时筛选</NuxtLink>
          <NuxtLink to="/guide" class="nav-link" :class="{ on: isActive('/guide') }">选购方法</NuxtLink>
          <NuxtLink to="/providers" class="nav-link" :class="{ on: isActive('/providers') }">服务商</NuxtLink>
          <NuxtLink to="/stats" class="nav-link" :class="{ on: isActive('/stats') }">统计</NuxtLink>
        </nav>

        <div class="header-status" :title="`汇率 ${rateLabel} · 点击切换币种`">
          <div class="chip-row">
            <button type="button" class="chip-btn" :class="{ on: currency === 'CNY' }" @click="toggle('CNY')">¥ CNY</button>
            <button type="button" class="chip-btn" :class="{ on: currency === 'USD' }" @click="toggle('USD')">$ USD</button>
          </div>
          <i
            class="dot"
            :title="lastRun ? `最近检测 ${fmtTime(lastRun.finishedAt)}` : '检测中'"
            :class="lastRun ? (lastRun.down ? 'is-down' : 'is-up') : 'is-unknown'"
          />
          <span class="mono" v-if="lastRun" style="font-size: 11px">
            UP {{ lastRun.up }}/{{ lastRun.total }}
          </span>
        </div>
      </div>
    </header>

    <main class="site-main">
      <NuxtPage />
    </main>

    <footer class="site-footer">
      <div class="wrap footer-inner">
        <div class="footer-col brand-col">
          <div class="brand-word small">VPS<em>报价单</em></div>
          <p class="muted">每日核价、每日检测：价格统一折算年付总价并按实时汇率标人民币；<br>服务商连通性每日 04:00 自动探测，挂了当场打标。链接含推广参数，不影响排名口径。</p>
        </div>
        <div class="footer-col">
          <h4>工具</h4>
          <NuxtLink to="/deals">实时筛选器</NuxtLink>
          <NuxtLink to="/guide">测速选购方法</NuxtLink>
          <NuxtLink to="/providers">服务商状态</NuxtLink>
          <NuxtLink to="/stats">访问统计</NuxtLink>
        </div>
        <div class="footer-col">
          <h4>口径</h4>
          <span class="muted">年付总价 = 期价年化（月付×12）</span>
          <span class="muted">连续 3 轮探测失败标 DOWN</span>
          <span class="muted">{{ rateLabel }}</span>
        </div>
        <div class="footer-col status-col">
          <h4>检测状态</h4>
          <span class="mono muted" v-if="lastRun">
            最近一轮 {{ fmtTime(lastRun.finishedAt) }}<br />
            耗时 {{ Math.round(lastRun.durationMs / 1000) }}s · 覆盖 {{ lastRun.total }} 家
          </span>
          <span class="mono muted" v-else>等待首轮检测…</span>
        </div>
      </div>
      <div class="footer-base wrap">
        <span class="mono muted">© {{ new Date().getFullYear() }} VPS 报价单 · 数据仅供参考，购买前请以厂商页面为准</span>
        <span class="mono muted">CHECK CRON 04:00 DAILY</span>
      </div>
    </footer>
  </div>
</template>
