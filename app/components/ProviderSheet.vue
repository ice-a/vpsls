<script setup lang="ts">
import type { ProviderRow } from '#shared/types'

/** 服务商目录：连通状态 + 价格摘要 */
defineProps<{ providers: ProviderRow[]; src?: string }>()
const { fmtPrice, fmtYear } = useFx()
</script>

<template>
  <div class="sheet">
    <table>
      <thead>
        <tr>
          <th>服务商</th>
          <th>特色</th>
          <th>机房</th>
          <th>套餐数</th>
          <th>最低年付</th>
          <th>最近检测</th>
          <th>状态 / 操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in providers" :key="p.slug">
          <td>
            <span class="p-name">{{ p.name }}</span>
            <span class="p-tag mono">{{ p.slug }}</span>
          </td>
          <td class="muted" style="font-size: 13px">{{ p.tagline }}</td>
          <td class="num faint" style="font-size: 12px">{{ p.regions.join(' / ') }}</td>
          <td class="num">{{ p.offerCount }}</td>
          <td class="num">
            <span v-if="p.cheapestPerYear != null" class="price-cell" :title="`月均 ${fmtPrice(p.cheapestPerMonth ?? 0).main}`">
              <span class="per" style="font-size: 15px">{{ fmtYear(p.cheapestPerYear, p.cheapestPerMonth ?? p.cheapestPerYear / 12).yearMain }}</span>
            </span>
            <span v-else-if="p.cheapestPerMonth !== null" class="price-cell">
              <span class="per" style="font-size: 15px">{{ fmtPrice(p.cheapestPerMonth).main }}/月</span>
            </span>
            <span v-else class="faint">—</span>
          </td>
          <td class="num faint" style="font-size: 12px">
            <template v-if="p.lastCheckedAt">
              {{ new Date(p.lastCheckedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}
            </template>
            <template v-else>未检测</template>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px">
              <StatusChip :availability="p.availability" />
              <NuxtLink class="btn btn-sm" :to="`/go/${p.slug}?src=${src ?? 'providers'}`" rel="sponsored noopener">
                官网
              </NuxtLink>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
