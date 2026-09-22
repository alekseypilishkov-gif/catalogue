<template>
  <div>
    <div class="first-screen">
      <LayoutHeader />
      <main id="main" class="catalogue-main" tabindex="-1" aria-label="Контент каталога" />
    </div>
    <LayoutFooter />
    <ParticlesParticleDebugPanel />
  </div>
</template>

<style scoped>
.first-screen { min-height: 100svh; display: flex; flex-direction: column; }
.catalogue-main { display: flex; flex: 1; outline: none; }
</style>
