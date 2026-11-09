<script setup lang="ts">
import type { Availability } from '#shared/types'

const props = defineProps<{ availability: Availability; compact?: boolean }>()

const label = computed(() =>
  props.availability === 'up' ? '在线' : props.availability === 'down' ? '不可达' : '待检测'
)
</script>

<template>
  <span class="chip" :class="availability" :title="`连通性：${label}`">
    <i class="dot" :class="availability === 'up' ? 'is-up' : availability === 'down' ? 'is-down' : 'is-unknown'" />
    <template v-if="!compact">{{ label }}</template>
  </span>
</template>
