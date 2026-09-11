// Small, non-exhaustive suggestions; these lists imply no university/program relationship.
export const UNIVERSITY_SUGGESTIONS = [
  'Ankara Üniversitesi', 'Atatürk Üniversitesi', 'Balıkesir Üniversitesi',
  'Boğaziçi Üniversitesi', 'Bursa Uludağ Üniversitesi', 'Çanakkale Onsekiz Mart Üniversitesi',
  'Çukurova Üniversitesi', 'Dokuz Eylül Üniversitesi', 'Ege Üniversitesi',
  'Erciyes Üniversitesi', 'Eskişehir Osmangazi Üniversitesi', 'Gazi Üniversitesi',
  'Hacettepe Üniversitesi', 'İhsan Doğramacı Bilkent Üniversitesi', 'İstanbul Üniversitesi',
  'İstanbul Teknik Üniversitesi', 'İzmir Yüksek Teknoloji Enstitüsü', 'Koç Üniversitesi',
  'Marmara Üniversitesi', 'Ondokuz Mayıs Üniversitesi', 'Orta Doğu Teknik Üniversitesi',
  'Pamukkale Üniversitesi', 'Sabancı Üniversitesi', 'Sakarya Üniversitesi',
  'Selçuk Üniversitesi', 'Yıldız Teknik Üniversitesi',
] as const

export const PROGRAM_SUGGESTIONS = [
  'Bilgisayar Mühendisliği', 'Diş Hekimliği', 'Eczacılık', 'Elektrik-Elektronik Mühendisliği',
  'Endüstri Mühendisliği', 'Hukuk', 'Hemşirelik', 'İktisat', 'İnşaat Mühendisliği',
  'İşletme', 'Makine Mühendisliği', 'Mimarlık', 'Psikoloji', 'Rehberlik ve Psikolojik Danışmanlık',
  'Tıp', 'Türkçe Öğretmenliği', 'Uluslararası İlişkiler', 'Veterinerlik',
  'Yazılım Mühendisliği', 'Yönetim Bilişim Sistemleri',
] as const

function searchKey(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')
}

export function filterGoalSuggestions(options: readonly string[], query: string) {
  const key = searchKey(query)
  return key ? options.filter(option => searchKey(option).includes(key)).slice(0, 8) : []
}

export function nextGoalOption(current: number, count: number, direction: 1 | -1) {
  if (!count) return -1
  if (current < 0) return direction === 1 ? 0 : count - 1
  return (current + direction + count) % count
}
