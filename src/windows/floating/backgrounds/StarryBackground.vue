<template>
  <canvas ref="canvasRef" class="starry-bg"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { FloatingStyleConfig } from '../../../../shared/relay-types'

const props = defineProps<{
  config: FloatingStyleConfig
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null

interface Star {
  x: number
  y: number
  radius: number
  opacity: number
  twinkleSpeed: number
  twinklePhase: number
  rotation: number
  points: number
}

let stars: Star[] = []

function createStars(width: number, height: number): Star[] {
  const count = Math.floor((width * height) / 1200)
  const newStars: Star[] = []
  for (let i = 0; i < count; i++) {
    const points = Math.random() > 0.3 ? 4 : 6
    newStars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      opacity: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      points
    })
  }
  return newStars
}

function drawStarShape(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, points: number, rotation: number) {
  const innerRadius = radius * 0.4
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? radius : innerRadius
    const angle = (Math.PI * 2 * i) / (points * 2) + rotation
    const px = x + Math.cos(angle) * r
    const py = y + Math.sin(angle) * r
    if (i === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  }
  ctx.closePath()
}

function drawStarryBackground(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  // 深色背景
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#0a0a1a')
  gradient.addColorStop(0.5, '#0f0f2a')
  gradient.addColorStop(1, '#0a0a1a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // 绘制星星
  for (const star of stars) {
    const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7
    const alpha = star.opacity * twinkle

    // 绘制星形
    drawStarShape(ctx, star.x, star.y, star.radius, star.points, star.rotation)
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
    ctx.fill()

    // 较大的星星添加光晕
    if (star.radius > 1.5) {
      drawStarShape(ctx, star.x, star.y, star.radius * 2.5, star.points, star.rotation)
      ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.1})`
      ctx.fill()
    }
  }
}

function animate(time: number) {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  drawStarryBackground(ctx, canvas.width, canvas.height, time)
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  stars = createStars(canvas.width, canvas.height)
  animationId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.starry-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 16px;
}
</style>
