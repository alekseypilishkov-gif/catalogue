<script setup lang="ts">
const { settings } = usePolygonWaveDebug()
</script>

<template>
  <div>
    <div class="first-screen">
      <ParticlesPolygonWaveBackground />
      <LayoutHeader />
      <main id="main" class="catalogue-main" :class="{ 'is-debug-hidden': settings.cardsHidden }" tabindex="-1" aria-label="Контент каталога">
        <div class="container"><CatalogHoverPrototypeCard /></div>
      </main>
    </div>
    <LayoutFooter />
    <ParticlesParticleDebugPanel />
  </div>
</template>

<style scoped>
.first-screen { position: relative; min-height: 100svh; display: flex; flex-direction: column; overflow: hidden; isolation: isolate; }
.catalogue-main { position: relative; z-index: 1; flex: 1; padding-block: 283px 160px; outline: none; transition: opacity 220ms ease, visibility 220ms; }
.catalogue-main.is-debug-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
@media (max-width: 767px) { .catalogue-main { padding-block: 160px 80px; } }
</style>
