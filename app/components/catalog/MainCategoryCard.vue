<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description: string
  href: string
  state?: 'idle' | 'hover' | 'active'
}>(), { state: 'idle' })

const { card, isCursorInside, enter, leave, moveCursor } = useCardCursorGlow()
</script>

<template>
  <a ref="card" :href="href" class="catalogue-card main-card" :class="{ 'has-cursor-glow': isCursorInside }" :data-state="state" @mouseenter="enter" @mousemove="moveCursor" @mouseleave="leave">
    <span class="card-cursor-glow" aria-hidden="true" />
    <h3 class="main-card__title">{{ title }}</h3>
    <p class="main-card__description">{{ description }}</p>
  </a>
</template>

<style scoped>
.main-card { display: flex; flex-direction: column; justify-content: center; gap: 16px; min-height: 152px; padding: 31px; }
.main-card__title { color: var(--card-title-color); font-size: 32px; font-weight: 400; line-height: 1.23; letter-spacing: .05em; text-transform: uppercase; transition: color 220ms ease; }
.main-card:hover .main-card__title, .main-card:focus-visible .main-card__title, .main-card[data-state='hover'] .main-card__title { color: var(--card-hover-title-color); }
.main-card__description { font-size: clamp(16px, 1.042vw, 20px); line-height: 1.4; letter-spacing: .05em; }
@media (max-width: 1199px) { .main-card { padding: 24px; } .main-card__title { font-size: clamp(24px, 2.667vw, 32px); } }
@media (max-width: 599px) { .main-card { min-height: 144px; gap: 12px; padding: 23px; } .main-card__title { font-size: 23px; } }
</style>
