<template>
  <div class="aurora-bg">
    <div class="aurora-layer aurora-1"></div>
    <div class="aurora-layer aurora-2"></div>
    <div class="aurora-layer aurora-3"></div>
  </div>
</template>

<script setup lang="ts">
import type { FloatingStyleConfig } from '../../../../shared/relay-types'

defineProps<{
  config: FloatingStyleConfig
}>()
</script>

<style scoped>
.aurora-bg {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #0a0a2e 0%, #0f0f1f 100%);
}

.aurora-layer {
  position: absolute;
  inset: 0;
  opacity: 0.6;
  mix-blend-mode: screen;
}

.aurora-1 {
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(100, 200, 150, 0.3) 30%,
    rgba(50, 150, 200, 0.2) 50%,
    transparent 70%
  );
  animation: auroraMove1 8s ease-in-out infinite;
}

.aurora-2 {
  background: linear-gradient(
    180deg,
    transparent 20%,
    rgba(150, 100, 255, 0.25) 40%,
    rgba(100, 200, 255, 0.15) 60%,
    transparent 80%
  );
  animation: auroraMove2 12s ease-in-out infinite;
}

.aurora-3 {
  background: linear-gradient(
    180deg,
    transparent 10%,
    rgba(50, 255, 150, 0.2) 35%,
    rgba(200, 100, 255, 0.1) 55%,
    transparent 75%
  );
  animation: auroraMove3 10s ease-in-out infinite;
}

@keyframes auroraMove1 {
  0%, 100% {
    transform: translateX(-10%) scaleY(1);
  }
  50% {
    transform: translateX(10%) scaleY(1.2);
  }
}

@keyframes auroraMove2 {
  0%, 100% {
    transform: translateX(15%) scaleY(1.1);
  }
  50% {
    transform: translateX(-15%) scaleY(0.9);
  }
}

@keyframes auroraMove3 {
  0%, 100% {
    transform: translateX(-5%) scaleY(0.9);
  }
  50% {
    transform: translateX(5%) scaleY(1.15);
  }
}
</style>
