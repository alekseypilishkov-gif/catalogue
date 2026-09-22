<script setup lang="ts">
import type { ParticleMode } from '~/types/particles'
withDefaults(defineProps<{ mode?: ParticleMode }>(), { mode: 'logo' })
const asset = useAssetUrl()
// Renderer boundary: replace the image inside this host with a client-only canvas.
// Future renderers own resize, reduced-motion handling and GPU cleanup on unmount.
// All modes intentionally share the approved static logo in this foundation.
</script>

<template>
  <div class="particle-canvas" :data-mode="mode" data-renderer="static" aria-hidden="true">
    <img :src="asset('images/particle-logo.png')" width="1536" height="1024" alt="" fetchpriority="high" decoding="async" />
  </div>
</template>

<style scoped>
.particle-canvas { pointer-events: none; user-select: none; overflow: hidden; }
.particle-canvas img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
