<script setup lang="ts">
useSeoMeta({
  title: '服务商目录与状态 · VPS 报价单',
  description: '全部 VPS 服务商一览：套餐数、最低月付、官网连通性每日 04:00 自动检测。'
})

const { data, refresh } = await useFetch('/api/providers')

const checking = ref(false)
const lastManual = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

/** 手动触发一轮检测（与每日 04:00 的定时任务同一实现） */
const triggerCheck = async () => {
  checking.value = true
  errorMsg.value = null
  try {
    const res = await $fetch<{ run: { up: number; down: number; total: number; durationMs: number } }>('/api/check', {
      method: 'POST'
    })
    lastManual.value = `up ${res.run.up} · down ${res.run.down} · ${res.run.total} 家 · 耗时 ${Math.round(res.run.durationMs / 1000)}s`
    await refresh()
  } catch (e) {
    errorMsg.value = '检测请求失败，看下服务端日志。'
  } finally {
    checking.value = false
  }
}

// 官方套餐源手动刷新（force 绕过 24h 缓存）
const refetching = ref(false)
const refetchMsg = ref<string | null>(null)
const triggerRefetch = async () => {
  refetching.value = true
  refetchMsg.value = null
  try {
    const res = await $fetch<{ ok: string[]; fail: string[]; totalPlans: number; durationMs: number }>(
      '/api/refetch?force=1',
      { method: 'POST' }
    )
    refetchMsg.value = `✔ 官方源刷新：成功 ${res.ok.length} 家（${res.totalPlans} 条套餐），失败 ${res.fail.length} 家 · ${Math.round(res.durationMs / 1000)}s`
    await refresh()
  } catch {
    refetchMsg.value = '✘ 官方源刷新失败，看下服务端日志。'
  } finally {
    refetching.value = false
  }
}

const providers = computed(() => data.value?.providers ?? [])
const lastRun = computed(() => data.value?.lastRun ?? null)
</script>

<template>
  <div>
    <section class="hero" style="padding: 56px 0 36px">
      <div class="wrap">
        <div class="eyebrow">PROVIDER DIRECTORY · 服务商目录</div>
        <h1 style="font-size: clamp(30px, 4.5vw, 46px)">{{ providers.length }} 家厂商，一张状态表看完</h1>
        <p class="hero-sub">
          官网连通性每天 04:00 自动探测：2xx/3xx 即在线，连续 3 轮失败标「不可达」，恢复自动回绿。
          <span v-if="lastRun" class="mono">
            <br />最近一轮：{{ new Date(lastRun.finishedAt).toLocaleString('zh-CN') }}（{{ Math.round(lastRun.durationMs / 1000) }}s）
          </span>
        </p>

        <div class="prov-head" style="margin-top: 28px">
          <button class="btn btn-primary" type="button" :disabled="checking" @click="triggerCheck">
            {{ checking ? '检测中…' : '⚡ 立即触发检测' }}
          </button>
          <button class="btn" type="button" :disabled="refetching" @click="triggerRefetch">
            {{ refetching ? '抓取中…' : '⟳ 刷新官方套餐' }}
          </button>
          <span v-if="lastManual" class="mono" style="color: var(--accent); font-size: 13px">✔ 手动轮次完成：{{ lastManual }}</span>
          <span v-if="refetchMsg" class="mono" style="color: var(--accent); font-size: 13px">{{ refetchMsg }}</span>
          <span v-if="errorMsg" class="mono" style="color: var(--accent-clay); font-size: 13px">{{ errorMsg }}</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <span class="index">DIR</span>
          <h2>全部服务商</h2>
          <span class="desc">SORTED BY CHEAPEST $/MO ↑</span>
        </div>
        <ProviderSheet :providers="providers" />
      </div>
    </section>
  </div>
</template>
