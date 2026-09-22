<script setup lang="ts">
withDefaults(defineProps<{ title: string; state?: 'idle' | 'hover' | 'active' }>(), { state: 'idle' })
defineEmits<{ select: [] }>()

const { card, isCursorInside, enter, leave, moveCursor } = useCardCursorGlow()
</script>

<template>
  <button ref="card" type="button" class="catalogue-card industry-card" :class="{ 'has-cursor-glow': isCursorInside }" :data-state="state" aria-haspopup="dialog" @mouseenter="enter" @mousemove="moveCursor" @mouseleave="leave" @click="$emit('select')">
    <span class="card-cursor-glow" aria-hidden="true" />
    <span class="industry-card__title">{{ title }}</span>
  </button>
</template>

<style scoped>
.industry-card { display: flex; align-items: center; width: 100%; min-height: 76px; padding: 23px 31px; text-align: left; }
.industry-card__title { color: var(--card-title-color); font-size: clamp(14px, 1.042vw, 20px); font-weight: 500; line-height: 1.4; letter-spacing: .05em; text-transform: uppercase; transition: color 220ms ease; }
.industry-card:hover .industry-card__title, .industry-card:focus-visible .industry-card__title, .industry-card[data-state='hover'] .industry-card__title { color: var(--card-hover-title-color); }
@media (max-width: 1199px) { .industry-card { padding: 20px 23px; } .industry-card__title { font-size: 16px; } }
</style>
