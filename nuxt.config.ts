export default defineNuxtConfig({
  compatibilityDate: '2026-09-21',
  devtools: { enabled: false },
  telemetry: false,
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Каталог — ЛД',
      meta: [
        { name: 'description', content: 'Коммерческий и инженерный каталоги ЛД. Продукция, документация и технические решения для вашей отрасли.' },
        { name: 'theme-color', content: '#262626' },
      ],
    },
  },
  typescript: { strict: true },
})
