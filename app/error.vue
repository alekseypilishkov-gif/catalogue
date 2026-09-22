<script setup lang="ts">
import type { NuxtError } from '#app'
defineProps<{ error: NuxtError }>()
const home = useRuntimeConfig().app.baseURL
</script>

<template>
  <main class="error-page container">
    <p>{{ error.statusCode }}</p>
    <h1>{{ error.statusCode === 404 ? 'Страница не найдена' : 'Не удалось загрузить страницу' }}</h1>
    <a class="dialog-action" :href="home">Вернуться в каталог</a>
  </main>
</template>

<style scoped>
.error-page { min-height: 100svh; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 16px; }
.error-page > p { color: var(--color-accent); font-size: 20px; }
.error-page h1 { font-size: clamp(28px, 4vw, 48px); font-weight: 400; }
</style>
