<script setup lang="ts">
import type { Availability, Offer } from '#shared/types'
import { cycleLabel } from '#shared/format'

/**
 * 报价单表格：首页最便宜榜 / 筛选结果共用。
 * 所有购买链接统一走 /go/:slug（服务端替换成你的 aff），src 标记来源便于分析。
 */
const props = withDefaults(
  defineProps<{
    offers: Offer[]
    providerInfo: Record<string, { name: string; availability: Availability }>
    src?: string
    emptyText?: string
  }>(),
  { src: 'list', emptyText: '没有命中当前条件的套餐，放宽一下筛选试试。' }
)

const rows = computed(() => props.offers)
const { fmtPrice, fmtYear } = useFx()
</script>

<template>
  <div class="sheet">
    <table v-if="rows.length">
      <thead>
        <tr>
          <th>服务商</th>
          <th>配置</th>
          <th>年付价（主显）</th>
          <th>计费</th>
          <th>机房</th>
          <th>标签</th>
          <th>状态 / 操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in rows" :key="o.id">
          <td>
            <div class="cell-provider">
              <div>
                <span class="p-name">{{ providerInfo[o.providerSlug]?.name ?? o.providerSlug }}</span>
                <span class="p-tag mono">{{ o.providerSlug }}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="spec-line">
              <b>{{ o.cpu }}</b> vCPU · <b>{{ o.ram }}</b>GB · <b>{{ o.disk }}</b>GB {{ o.diskType }} · {{ o.bandwidth }}Mbps
            </span>
          </td>
          <td class="num price-cell">
            <span class="per">{{ fmtYear(o.perYear, o.perMonth).yearMain }}</span>
            <span class="cycle">
              {{ fmtYear(o.perYear, o.perMonth).monthMain }}<template v-if="fmtYear(o.perYear, o.perMonth).yearSub"> · {{ fmtYear(o.perYear, o.perMonth).yearSub }}</template>
            </span>
          </td>
          <td class="num faint">{{ cycleLabel(o.cycle) }}</td>
          <td class="num faint" style="font-size: 12px">{{ o.regions.join(' / ') }}</td>
          <td>
            <div class="tag-row">
              <span v-if="o.cycle === 'yearly'" class="tag yearly-tag">年付</span>
              <span v-if="o.source === 'official'" class="tag official" title="从厂商官网实时抓取">官方实时</span>
              <span v-for="t in o.tags" :key="t" class="tag" :class="{ hot: t.includes('神价') || t.includes('CN2 GIA') }">{{ t }}</span>
              <span v-if="o.os === 'windows'" class="tag">Windows</span>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px">
              <StatusChip :availability="providerInfo[o.providerSlug]?.availability ?? 'unknown'" compact />
              <NuxtLink class="btn btn-primary btn-sm" :to="`/go/${o.providerSlug}?offer=${o.id}&src=${src}`" rel="sponsored noopener">
                查看
              </NuxtLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">{{ emptyText }}</div>
  </div>
</template>
