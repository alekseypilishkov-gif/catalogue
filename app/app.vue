<script setup lang="ts">
const asset = useAssetUrl()
useHead({ link: [{ rel: 'icon', type: 'image/svg+xml', href: asset('images/logo.svg') }] })
</script>

<template>
  <NuxtRouteAnnouncer />
  <a class="skip-link" href="#main">Перейти к содержимому</a>
  <NuxtPage />
</template>
