<script setup lang="ts">
const { settings } = usePolygonWaveDebug()
</script>

<template>
  <div>
    <div class="first-screen">
      <ParticlesPolygonWaveBackground />
      <LayoutHeader />
      <main id="main" class="catalogue-main" :class="{ 'is-debug-hidden': settings.cardsHidden }" tabindex="-1" aria-label="Контент каталога" />
    </div>
    <LayoutFooter />
    <ParticlesParticleDebugPanel />
  </div>
</template>

<style scoped>
.first-screen { position: relative; min-height: 100svh; display: flex; flex-direction: column; overflow: hidden; isolation: isolate; }
.catalogue-main { position: relative; z-index: 1; display: flex; flex: 1; outline: none; transition: opacity 220ms ease, visibility 220ms; }
.catalogue-main.is-debug-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
</style>
