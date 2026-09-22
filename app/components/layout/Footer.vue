<script setup lang="ts">
import { LD_WEBSITE, legalLinks, navigation } from '~/data/catalogue'
const asset = useAssetUrl()
const pendingSection = ref<string | null>(null)
</script>

<template>
  <footer class="site-footer">
    <div class="container">
      <a :href="LD_WEBSITE + '/'" class="footer-logo" aria-label="ЛД — главная"><img :src="asset('images/logo-footer.svg')" width="94" height="41" alt="ЛД" loading="lazy" /></a>
      <div class="footer-top">
        <div class="footer-contacts">
          <address>
            <a href="tel:+73517304747">+7 (351) 730-47-47</a>
            <p>Пн-Пт 8:30-17:30</p>
            <p>Россия, Челябинская область, Челябинск, Енисейская, 56</p>
            <a class="accent-link" href="mailto:info@ld-pride.ru">info@ld-pride.ru</a>
          </address>
          <p class="social-heading">Мы в соцсетях</p>
          <div class="social-links">
            <a href="https://www.vk.com/chsgs/" aria-label="ЛД ВКонтакте"><UiBrandIcon name="vk" :size="32" /></a>
            <a href="https://www.youtube.com/@LDarmature/" aria-label="ЛД на YouTube"><UiBrandIcon name="youtube" :size="32" /></a>
          </div>
        </div>
        <nav v-for="(column, index) in [navigation.slice(0, 7), navigation.slice(7)]" :key="index" class="footer-nav" :aria-label="index === 0 ? 'Продукция и услуги' : 'О компании'">
          <template v-for="item in column" :key="item.title">
            <a v-if="item.path" :href="LD_WEBSITE + item.path">{{ item.title }}</a>
            <button v-else type="button" class="footer-pending" @click="pendingSection = item.title">{{ item.title }}</button>
          </template>
        </nav>
      </div>
      <div class="footer-bottom">
        <p>© 2022 ООО ТД «ЛД» Все права защищены законом об авторском праве, копирование информации без разрешения правообладателя - запрещено.</p>
        <nav class="legal-links" aria-label="Правовая информация"><a v-for="item in legalLinks" :key="item.path" class="accent-link" :href="LD_WEBSITE + item.path">{{ item.title }}</a></nav>
        <p>Предложения на сайте не являются публичной офертой. Информация на сайте о товаре носит рекламный характер и расценивается как приглашение делать оферты на основании п.1 ст. 437 Гражданского кодекса РФ.</p>
      </div>
    </div>
    <UiAppDialog :open="pendingSection !== null" :title="pendingSection || ''" @close="pendingSection = null">
      <p>Этот раздел будет подключён на следующем этапе.</p>
      <a class="dialog-action" :href="LD_WEBSITE + '/contacts/'">Связаться с ЛД</a>
    </UiAppDialog>
  </footer>
</template>

<style scoped>
.site-footer { padding-block: 78px 48px; border-top: 2px solid var(--color-accent); font-size: 14px; font-weight: 500; }
.footer-logo, .footer-logo img { display: block; width: 94px; height: 41px; }
.footer-logo { margin-bottom: 32px; }
.footer-top, .footer-bottom { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.footer-contacts address { display: grid; gap: 16px; font-style: normal; line-height: 1.4; }
.social-heading { margin-top: 23px; }
.social-links { display: flex; gap: 20px; margin-top: 8px; }
.social-links a { display: flex; align-items: center; min-height: 40px; }
.footer-nav { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; line-height: 1.2; }
.footer-pending { padding: 0; text-align: left; font-weight: inherit; }
.footer-bottom { margin-top: 78px; padding-top: 48px; border-top: 1px solid var(--color-accent); font-size: 12px; line-height: 1.6; }
.legal-links { display: flex; flex-direction: column; align-items: start; gap: 7px; }
@media (max-width: 999px) { .footer-top { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px 24px; } .footer-contacts { grid-column: 1 / -1; } .footer-bottom { grid-template-columns: 1fr; gap: 24px; margin-top: 48px; padding-top: 32px; } }
@media (max-width: 599px) { .site-footer { padding-block: 48px 32px; } .footer-top { gap: 32px 20px; font-size: 13px; } .footer-nav { gap: 18px; line-height: 1.5; } }
</style>
