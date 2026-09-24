<script setup lang="ts">
const { settings } = usePolygonWaveDebug()
const { card, glow, isCursorInside, enter, leave, moveCursor } = usePrototypeCardGlow()
</script>

<template>
  <div
    ref="card"
    class="hover-prototype"
    :class="{ 'is-hovered': isCursorInside }"
    :style="{
      '--prototype-glow-size': `${settings.cardGlowSize}%`,
      '--prototype-glow-brightness': settings.cardGlowBrightness,
      '--prototype-glow-blur': `${settings.cardGlowBlur}px`,
      '--prototype-card-blur': `${settings.cardBackgroundBlur}px`,
    }"
    aria-label="Прототип наведения на карточку каталога"
    @pointerenter="enter"
    @pointermove="moveCursor"
    @pointerleave="leave"
    @pointercancel="leave"
  >
    <span ref="glow" class="hover-prototype__glow" aria-hidden="true" />
    <span class="catalogue-card hover-prototype__surface" aria-hidden="true" />
  </div>
</template>

<style scoped>
.hover-prototype {
  position: relative;
  width: min(709px, 100%);
  aspect-ratio: 709 / 689;
  overflow: hidden;
  border-radius: 8px;
  isolation: isolate;
}

.hover-prototype__glow {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: 50%;
  width: var(--prototype-glow-size, 56.05%);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgb(255 242 77 / 46%) 0 13%,
    rgb(255 242 77 / 25%) 28%,
    rgb(255 242 77 / 9%) 48%,
    transparent 70%);
  opacity: 0;
  filter: blur(var(--prototype-glow-blur, 22px)) brightness(max(1, var(--prototype-glow-brightness, 1)));
  pointer-events: none;
  transform: translate3d(0, 0, 0) translate(-50%, -50%);
  transition: opacity 280ms ease;
}

.hover-prototype.is-hovered .hover-prototype__glow { opacity: min(var(--card-hover-glow-opacity, 1), var(--prototype-glow-brightness, 1)); }

.hover-prototype__surface {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: block;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: rgb(137 137 137 / 5%);
  box-shadow: var(--card-shadow);
  -webkit-backdrop-filter: blur(var(--prototype-card-blur, 64px));
  backdrop-filter: blur(var(--prototype-card-blur, 64px));
  pointer-events: none;
}

.hover-prototype__surface::before { display: none; }

.hover-prototype__surface::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid transparent;
  border-radius: inherit;
  background: linear-gradient(180deg, rgb(137 137 137 / 40%), rgb(137 137 137 / 20%)) border-box;
  -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .hover-prototype__glow { transition: none; }
}
</style>
