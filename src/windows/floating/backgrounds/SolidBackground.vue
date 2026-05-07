<template>
  <div class="solid-bg" :style="bgStyle"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FloatingStyleConfig } from '../../../../shared/relay-types'

const props = defineProps<{
  config: FloatingStyleConfig
}>()

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const bgStyle = computed(() => {
  const bg = hexToRgba(props.config.backgroundColor, props.config.backgroundOpacity)
  return {
    background: `linear-gradient(145deg, ${bg} 0%, ${bg} 100%)`
  }
})
</script>

<style scoped>
.solid-bg {
  position: absolute;
  inset: 0;
  border-radius: 16px;
}
</style>
