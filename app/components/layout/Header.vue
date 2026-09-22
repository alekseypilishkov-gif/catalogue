<script setup lang="ts">
import { LD_WEBSITE, industries, mainCategories, navigation } from '~/data/catalogue'

const asset = useAssetUrl()
const panel = ref<'catalogue' | 'search' | 'region' | 'menu' | 'cart' | null>(null)
const query = ref('')
const headings = { catalogue: 'Каталог', search: 'Поиск по каталогу', region: 'Ваш город', menu: 'Меню', cart: 'Корзина' }
const results = computed(() => mainCategories.filter(item => `${item.title} ${item.description}`.toLocaleLowerCase('ru').includes(query.value.trim().toLocaleLowerCase('ru'))))
const industryResults = computed(() => industries.filter(item => item.title.toLocaleLowerCase('ru').includes(query.value.trim().toLocaleLowerCase('ru'))))
</script>

<template>
  <header class="site-header" :style="{ '--header-wave': `url('${asset('images/header-wave.png')}')` }">
    <div class="container header-glass">
      <nav class="header-left" aria-label="Каталог и поиск">
        <button class="header-catalogue" type="button" aria-haspopup="dialog" @click="panel = 'catalogue'">
          <span>Каталог</span><UiBrandIcon name="chevron-down" :size="16" />
        </button>
        <button class="icon-button" type="button" aria-label="Открыть поиск" aria-haspopup="dialog" @click="panel = 'search'"><UiBrandIcon name="search" /></button>
      </nav>
      <a :href="LD_WEBSITE + '/'" class="header-logo" aria-label="ЛД — главная">
        <img :src="asset('images/logo.svg')" width="79" height="48" alt="ЛД" />
      </a>
      <nav class="header-right" aria-label="Основная навигация">
        <button class="header-city" type="button" aria-haspopup="dialog" @click="panel = 'region'">Челябинск</button>
        <button class="icon-button" type="button" aria-label="Открыть меню" aria-haspopup="dialog" @click="panel = 'menu'"><UiBrandIcon name="menu" /></button>
        <button class="icon-button cart-button" type="button" aria-label="Корзина, 0 товаров" aria-haspopup="dialog" @click="panel = 'cart'">
          <UiBrandIcon name="cart" :size="20" /><span class="cart-count" aria-hidden="true">0</span>
        </button>
        <a class="icon-button" :href="LD_WEBSITE + '/profile'" aria-label="Личный кабинет"><UiBrandIcon name="user" /></a>
      </nav>
    </div>
    <UiAppDialog :open="panel !== null" :title="panel ? headings[panel] : ''" @close="panel = null">
      <template v-if="panel === 'catalogue'">
        <div class="dialog-links"><a v-for="item in mainCategories" :key="item.id" :href="item.href">{{ item.title }}</a></div>
      </template>
      <template v-else-if="panel === 'search'">
        <label class="search-label" for="catalogue-search">Название каталога или отрасли</label>
        <input id="catalogue-search" v-model="query" class="search-input" type="search" placeholder="Например, водоснабжение" autocomplete="off" />
        <div class="search-results" aria-live="polite">
          <div class="dialog-links"><a v-for="item in results" :key="item.id" :href="item.href">{{ item.title }}</a></div>
          <ul v-if="industryResults.length" class="search-industries"><li v-for="item in industryResults" :key="item.id">{{ item.title }}</li></ul>
          <p v-if="!results.length && !industryResults.length">Ничего не найдено. Попробуйте другое название.</p>
          <p v-if="industryResults.length" class="dialog-note">Товары по отраслям появятся на следующем этапе. Сейчас доступен <a class="accent-link" :href="LD_WEBSITE + '/catalog/'">общий каталог</a>.</p>
        </div>
      </template>
      <template v-else-if="panel === 'region'">
        <p>Текущий город — Челябинск.</p>
        <p class="dialog-note">Выбор региона будет подключён вместе с каталогом.</p>
        <a class="dialog-action" :href="LD_WEBSITE + '/contacts/#wherebuy'">Найти ближайшего дилера</a>
      </template>
      <template v-else-if="panel === 'menu'">
        <nav class="dialog-links" aria-label="Разделы сайта"><a v-for="item in navigation.filter(item => item.path)" :key="item.title" :href="LD_WEBSITE + item.path">{{ item.title }}</a></nav>
      </template>
      <template v-else-if="panel === 'cart'">
        <p>В корзине пока нет товаров.</p>
        <p class="dialog-note">Покупки будут доступны после подключения коммерческого каталога.</p>
        <a class="dialog-action" :href="LD_WEBSITE + '/catalog/'">Открыть каталог ЛД</a>
      </template>
    </UiAppDialog>
  </header>
</template>

<style scoped>
.site-header { position: fixed; inset: 0 0 auto; z-index: 30; isolation: isolate; padding-top: 29px; background: transparent; }
.site-header::before { content: ''; position: absolute; z-index: -1; inset: 0 0 auto; height: 137px; pointer-events: none; background: var(--header-wave) top center / cover no-repeat; mix-blend-mode: lighten; opacity: .5; }
.header-glass { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 64px; padding: 8px 12px; border: 1px solid rgb(137 137 137 / 40%); border-radius: 8px; background: rgb(38 38 38 / 30%); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.header-left, .header-right { display: flex; align-items: center; gap: 12px; }
.header-right { justify-content: flex-end; }
.header-catalogue, .header-city { display: flex; align-items: center; justify-content: center; gap: 20px; min-height: 48px; padding: 12px 31px; font-size: 16px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; border-radius: 8px; }
.header-logo, .header-logo img { display: block; width: 79px; height: 48px; }
.cart-button { position: relative; }
.cart-count { position: absolute; top: 10px; right: 12px; padding: 0 3px; border-radius: 8px; color: var(--color-bg); background: #fff; font-size: 10px; line-height: 13px; font-weight: 600; }
.search-label { display: block; margin-bottom: 12px; font-size: 14px; }
.search-input { width: 100%; padding: 16px; border: 1px solid #ffffff40; border-radius: 6px; color: white; background: #171717; }
.search-results { margin-top: 24px; }
.search-industries { display: grid; gap: 16px; margin-block: 20px; list-style: none; font-size: 16px; }
@media (max-width: 1199px) { .header-city { padding-inline: 8px; font-size: 13px; } .header-catalogue { padding-inline: 12px; font-size: 14px; } .header-left, .header-right { gap: 4px; } }
@media (max-width: 767px) { .site-header { padding-top: 16px; } .header-glass { min-height: 64px; padding: 8px; } .header-city, .cart-button { display: none; } .header-catalogue { padding-inline: 4px; gap: 6px; font-size: 11px; } .header-catalogue img { width: 12px; height: 12px; } .header-logo, .header-logo img { width: 64px; height: 39px; } .icon-button { width: 36px; min-height: 44px; } .header-left, .header-right { gap: 0; } }
</style>
