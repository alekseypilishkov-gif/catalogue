export const LD_WEBSITE = 'https://xn--d1an.xn--p1ai'

export const mainCategories = [
  { id: 'commercial', title: 'Коммерческий каталог', description: 'Более 1 000 000 наименований товаров', href: `${LD_WEBSITE}/catalog/` },
  { id: 'engineering', title: 'Инженерный каталог', description: 'Документация, модели и технические решения', href: `${LD_WEBSITE}/documentation-center/` },
] as const

export const industries = [
  { id: 'heating', title: 'Тепловые сети и теплогенерация' },
  { id: 'construction', title: 'Строительство и ЖКХ' },
  { id: 'water', title: 'Водоснабжение' },
  { id: 'industrial', title: 'Промышленные предприятия' },
  { id: 'gas', title: 'Газовые сети и газораспределение' },
  { id: 'oem', title: 'Производители оборудования (OEM)' },
] as const

export const navigation = [
  { title: 'Каталог', path: '/catalog/' },
  { title: 'Где купить', path: '/contacts/#wherebuy' },
  { title: 'Центр документации', path: '/documentation-center/' },
  { title: 'Объекты монтажа', path: null },
  { title: 'Сервис', path: '/obratitsa_v_servisnuu_sluzbu_ld/' },
  { title: 'Материалы для скачивания', path: '/download/' },
  { title: 'Услуги кооперации', path: '/info_cooperation/' },
  { title: 'Новости', path: '/info_novosti/' },
  { title: 'Вакансии', path: null },
  { title: 'Участие в ассоциациях', path: '/info_partners/' },
  { title: 'Проверить статус обращения', path: '/proverka_statusa_obrasenia/' },
  { title: 'Проверить статус дилера', path: '/supplierstatuscheck/' },
  { title: 'Написать директору', path: '/appeal' },
  { title: 'Контакты', path: '/contacts/' },
] as const

export const legalLinks = [
  { title: 'Политика конфиденциальности', path: '/politika_konfidencial_nosti/' },
  { title: 'Политика использования cookie-файлов', path: '/politika_ispolzovania_fajlov_cookies/' },
  { title: 'Пользовательское соглашение', path: '/polzovatelskoe_soglasenie' },
] as const
