<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 24 })
const asset = useAssetUrl()
</script>

<template>
  <img :src="asset(`images/${name}.svg`)" :width="size" :height="size" alt="" aria-hidden="true" class="brand-icon" />
</template>

<style scoped>
.brand-icon { display: block; flex: none; object-fit: contain; }
</style>
