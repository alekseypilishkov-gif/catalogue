<script setup lang="ts">
const isOpen = ref(false)
</script>

<template>
  <Teleport to="body">
    <section class="particle-debug" aria-label="Particle debug panel">
      <button class="particle-debug__toggle" type="button" :aria-expanded="isOpen" @click="isOpen = !isOpen">
        {{ isOpen ? 'Hide particle controls' : 'Particle controls' }}
      </button>
      <div v-if="isOpen" class="particle-debug__panel">
        <p>Настройки временно отключены.</p>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.particle-debug { position: fixed; z-index: 20; bottom: 16px; left: 16px; width: min(310px, calc(100vw - 32px)); color: #e8f5f5; font: 12px/1.35 Arial, sans-serif; }
.particle-debug__toggle { width: 100%; padding: 10px 12px; border: 1px solid rgb(157 235 231 / 42%); border-radius: 8px; background: rgb(20 29 30 / 92%); color: inherit; text-align: left; text-transform: uppercase; letter-spacing: .08em; cursor: pointer; }
.particle-debug__panel { margin-top: 8px; padding: 12px; border: 1px solid rgb(157 235 231 / 30%); border-radius: 8px; background: rgb(20 29 30 / 94%); box-shadow: 0 10px 30px rgb(0 0 0 / 28%); }
.particle-debug__panel p { margin: 0; color: rgb(232 245 245 / 70%); }
@media (max-width: 599px) { .particle-debug { bottom: 8px; left: 8px; width: min(290px, calc(100vw - 16px)); } }
</style>
