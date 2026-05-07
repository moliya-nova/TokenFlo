<template>
  <canvas ref="canvasRef" class="particles-bg"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { FloatingStyleConfig } from '../../../../shared/relay-types'

const props = defineProps<{
  config: FloatingStyleConfig
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  fadeSpeed: number
  life: number
  maxLife: number
}

let particles: Particle[] = []

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.3 - 0.1,
    radius: Math.random() * 2 + 0.5,
    opacity: 0,
    fadeSpeed: Math.random() * 0.01 + 0.005,
    life: 0,
    maxLife: Math.random() * 300 + 200
  }
}

function initParticles(width: number, height: number) {
  const count = Math.floor((width * height) / 2000)
  particles = []
  for (let i = 0; i < count; i++) {
    const p = createParticle(width, height)
    p.life = Math.random() * p.maxLife
    particles.push(p)
  }
}

function updateParticle(p: Particle, width: number, height: number) {
  p.x += p.vx
  p.y += p.vy
  p.life++

  // 淡入淡出效果
  const lifeProgress = p.life / p.maxLife
  if (lifeProgress < 0.1) {
    p.opacity = lifeProgress / 0.1
  } else if (lifeProgress > 0.9) {
    p.opacity = (1 - lifeProgress) / 0.1
  } else {
    p.opacity = 1
  }

  // 重置超出边界的粒子
  if (p.life >= p.maxLife || p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) {
    Object.assign(p, createParticle(width, height))
    p.y = height + 5
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // 深色背景
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#0c0c1d')
  gradient.addColorStop(1, '#1a1a3e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // 绘制粒子
  for (const p of particles) {
    updateParticle(p, width, height)

    const alpha = p.opacity * 0.6
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(150, 180, 255, ${alpha})`
    ctx.fill()

    // 添加光晕
    if (p.radius > 1) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(100, 150, 255, ${alpha * 0.1})`
      ctx.fill()
    }
  }
}

function animate() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  drawParticles(ctx, canvas.width, canvas.height)
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  initParticles(canvas.width, canvas.height)
  animationId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<style scoped>
.particles-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 16px;
}
</style>
