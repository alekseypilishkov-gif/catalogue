<script setup lang="ts">
import { LD_WEBSITE, industries, mainCategories } from '~/data/catalogue'
const selectedIndustry = ref<string | null>(null)
const visibleCardCount = ref(0)
const totalEntranceCards = mainCategories.length + industries.length
let entranceTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    visibleCardCount.value = totalEntranceCards
    return
  }

  requestAnimationFrame(() => {
    const revealNextCard = () => {
      visibleCardCount.value += 1
      if (visibleCardCount.value < totalEntranceCards) entranceTimer = window.setTimeout(revealNextCard, 80)
    }
    revealNextCard()
  })
})

onBeforeUnmount(() => {
  if (entranceTimer) window.clearTimeout(entranceTimer)
})
</script>

<template>
  <div>
    <div class="first-screen">
      <LayoutHeader />
      <main id="main" class="catalogue-main" tabindex="-1">
        <div class="page-heading">
          <div class="container">
            <nav class="breadcrumbs" aria-label="Хлебные крошки"><a :href="LD_WEBSITE + '/'">Главная</a><UiBrandIcon name="chevron-right" :size="16" /></nav>
            <h1>Каталог</h1>
          </div>
        </div>
        <section class="catalogue-hero" aria-label="Выбор каталога">
          <div class="container catalogue-grid">
            <ParticlesParticleCanvas class="hero-particles" mode="logo" />
            <section class="catalogue-column catalogue-primary" aria-labelledby="main-categories-title">
              <h2 id="main-categories-title">Основные</h2>
              <p class="section-description">Ознакомьтесь с ассортиментом и техническими данным нашей продукции</p>
              <div class="main-card-list"><CatalogMainCategoryCard v-for="(item, index) in mainCategories" :key="item.id" :title="item.title" :description="item.description" :href="item.href" :class="{ 'is-entrance-visible': visibleCardCount > index }" /></div>
            </section>
            <section class="catalogue-column catalogue-industries" aria-labelledby="industry-categories-title">
              <h2 id="industry-categories-title">По отраслям</h2>
              <p class="section-description">Выборка категорий продукции,<br class="desktop-break" /> отфильтрованная по конкретной отрасли</p>
              <div class="industry-card-list"><CatalogIndustryCard v-for="(item, index) in industries" :key="item.id" :title="item.title" :class="{ 'is-entrance-visible': visibleCardCount > index + mainCategories.length }" @select="selectedIndustry = item.title" /></div>
            </section>
          </div>
        </section>
      </main>
    </div>
    <LayoutFooter />
    <UiAppDialog :open="selectedIndustry !== null" :title="selectedIndustry || ''" @close="selectedIndustry = null">
      <p>Отраслевая подборка появится на следующем этапе.</p>
      <p class="dialog-note">Сейчас вы можете ознакомиться с полным ассортиментом продукции ЛД.</p>
      <a class="dialog-action" :href="LD_WEBSITE + '/catalog/'">Перейти в коммерческий каталог</a>
    </UiAppDialog>
  </div>
</template>

<style scoped>
.first-screen { min-height: 100svh; display: flex; flex-direction: column; }
.catalogue-main { display: flex; flex-direction: column; flex: 1; outline: none; }
.page-heading { padding-block: 110px 32px; background: var(--color-bg-secondary); }
.breadcrumbs { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; font-size: 14px; line-height: 20px; letter-spacing: .05em; text-transform: uppercase; }
h1 { font-size: 36px; font-weight: 400; line-height: 1.4; letter-spacing: .05em; text-transform: uppercase; }
.catalogue-hero { display: flex; flex: 1; overflow: hidden; }
.catalogue-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 24px; align-content: start; padding-block: 48px 64px; }
.catalogue-column { position: relative; grid-row: 1; z-index: 1; min-width: 0; }
.catalogue-primary { grid-column: 1 / span 5; }
.catalogue-industries { grid-column: 9 / span 4; }
.catalogue-column h2 { margin-bottom: 16px; font-size: clamp(30px, 2.084vw, 40px); line-height: 1.4; font-weight: 400; letter-spacing: .05em; text-transform: uppercase; }
.section-description { max-width: 561px; min-height: 56px; margin-bottom: 24px; font-size: clamp(16px, 1.042vw, 20px); line-height: 1.4; letter-spacing: .05em; }
.main-card-list { display: grid; gap: 24px; }
.industry-card-list { display: grid; gap: 16px; }
:deep(.catalogue-card) { opacity: 0; transform: perspective(1200px) rotateX(-70deg) translateY(40px); transform-origin: center top; transition: opacity 600ms cubic-bezier(.22, 1, .36, 1), transform 600ms cubic-bezier(.22, 1, .36, 1); }
:deep(.catalogue-card.is-entrance-visible) { opacity: 1; transform: perspective(1200px) rotateX(0deg) translateY(0); }
.hero-particles { position: fixed; top: 236px; left: 50%; z-index: 0; width: min(1102px, 57vw); aspect-ratio: 1102 / 774; transform: translateX(-50%); }
@media (min-width: 1200px) and (max-height: 900px) { .catalogue-grid { padding-block: 32px 48px; } .hero-particles { top: 228px; } .page-heading { padding-block: 110px 24px; } .catalogue-column h2 { margin-bottom: 12px; } .section-description { margin-bottom: 20px; } .industry-card-list { gap: 12px; } .industry-card-list :deep(.industry-card) { min-height: 64px; padding-block: 17px; } }
@media (max-width: 1399px) { .catalogue-primary { grid-column: 1 / span 6; } .catalogue-industries { grid-column: 8 / span 5; } .desktop-break { display: none; } }
@media (max-width: 999px) { .catalogue-grid { row-gap: 48px; padding-block: 40px 64px; } .catalogue-primary, .catalogue-industries { grid-column: 1 / -1; grid-row: auto; } .catalogue-primary { grid-row: 1; } .catalogue-industries { grid-row: 2; } .hero-particles { position: static; grid-column: 2 / -1; grid-row: 1 / 3; width: auto; margin: 0; transform: none; } .section-description { min-height: 0; max-width: 640px; } .main-card-list, .industry-card-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 599px) { .page-heading { padding-block: 96px 28px; } h1 { font-size: 28px; } .breadcrumbs { margin-bottom: 20px; font-size: 12px; } .catalogue-grid { row-gap: 44px; padding-top: 32px; } .catalogue-column h2 { font-size: 28px; margin-bottom: 12px; } .section-description { font-size: 16px; margin-bottom: 24px; } .main-card-list, .industry-card-list { grid-template-columns: 1fr; gap: 16px; } .hero-particles { grid-column: 1 / -1; margin-inline: -16px; margin-top: 70px; width: calc(100% + 32px); } }
@media (prefers-reduced-motion: reduce) { :deep(.catalogue-card) { opacity: 1; transform: none; transition: none; } }
</style>
