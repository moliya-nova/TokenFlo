<template>
  <div class="image-bg" :style="bgStyle"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FloatingStyleConfig } from '../../../../shared/relay-types'

const props = defineProps<{
  config: FloatingStyleConfig
}>()

const bgStyle = computed(() => {
  if (!props.config.backgroundImage) {
    return {
      background: 'linear-gradient(145deg, #12161e 0%, #0c1018 100%)'
    }
  }
  return {
    backgroundImage: `url(${props.config.backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: props.config.backgroundImageOpacity,
    filter: props.config.backgroundImageBlur > 0 ? `blur(${props.config.backgroundImageBlur}px)` : 'none'
  }
})
</script>

<style scoped>
.image-bg {
  position: absolute;
  inset: 0;
  border-radius: 16px;
}
</style>
