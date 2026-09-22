<script setup lang="ts">
import hoverGlowAsset from '~/assets/images/undercard-hover.svg'

withDefaults(defineProps<{ title: string; state?: 'idle' | 'hover' | 'active' }>(), { state: 'idle' })
defineEmits<{ select: [] }>()

const { card, isCursorInside, enter, leave, moveCursor } = useCardCursorGlow()
</script>

<template>
  <button ref="card" type="button" class="catalogue-card industry-card" :class="{ 'has-cursor-glow': isCursorInside }" :data-state="state" aria-haspopup="dialog" @mouseenter="enter" @mousemove="moveCursor" @mouseleave="leave" @click="$emit('select')">
    <span class="card-cursor-glow" :style="{ backgroundImage: `url(${hoverGlowAsset})` }" aria-hidden="true" />
    <span>{{ title }}</span>
  </button>
</template>

<style scoped>
.industry-card { display: flex; align-items: center; width: 100%; min-height: 76px; padding: 23px 31px; text-align: left; }
.industry-card span { color: var(--card-title-color); font-size: clamp(14px, 1.042vw, 20px); font-weight: 500; line-height: 1.4; letter-spacing: .05em; text-transform: uppercase; }
@media (max-width: 1199px) { .industry-card { padding: 20px 23px; } .industry-card span { font-size: 16px; } }
</style>
