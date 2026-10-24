import type { Locale } from './locales'

const STUDY_IDS = [
  'it',
  'de',
  'ru',
  'zh',
  'en',
  'es',
  'fr',
  'pt',
  'ja',
  'ko',
  'ar',
  'tr',
  'pl',
  'uk',
  'nl',
  'sv',
  'el',
  'hi',
] as const

export type StudyId = (typeof STUDY_IDS)[number]

/** Nominative name of a study language, in each interface language. */
export const STUDY_NAMES: Record<StudyId, Record<Locale, string>> = {
  it: pack('Итальянский', 'Italian', 'Italiano', 'Italienisch', 'Italien', 'Italiano', 'Italiano', '意大利语', 'イタリア語', '이탈리아어', 'İtalyanca', 'Włoski', 'Італійська'),
  de: pack('Немецкий', 'German', 'Alemán', 'Deutsch', 'Allemand', 'Alemão', 'Tedesco', '德语', 'ドイツ語', '독일어', 'Almanca', 'Niemiecki', 'Німецька'),
  ru: pack('Русский', 'Russian', 'Ruso', 'Russisch', 'Russe', 'Russo', 'Russo', '俄语', 'ロシア語', '러시아어', 'Rusça', 'Rosyjski', 'Російська'),
  zh: pack('Китайский', 'Chinese', 'Chino', 'Chinesisch', 'Chinois', 'Chinês', 'Cinese', '中文', '中国語', '중국어', 'Çince', 'Chiński', 'Китайська'),
  en: pack('Английский', 'English', 'Inglés', 'Englisch', 'Anglais', 'Inglês', 'Inglese', '英语', '英語', '영어', 'İngilizce', 'Angielski', 'Англійська'),
  es: pack('Испанский', 'Spanish', 'Español', 'Spanisch', 'Espagnol', 'Espanhol', 'Spagnolo', '西班牙语', 'スペイン語', '스페인어', 'İspanyolca', 'Hiszpański', 'Іспанська'),
  fr: pack('Французский', 'French', 'Francés', 'Französisch', 'Français', 'Francês', 'Francese', '法语', 'フランス語', '프랑스어', 'Fransızca', 'Francuski', 'Французька'),
  pt: pack('Португальский', 'Portuguese', 'Portugués', 'Portugiesisch', 'Portugais', 'Português', 'Portoghese', '葡萄牙语', 'ポルトガル語', '포르투갈어', 'Portekizce', 'Portugalski', 'Португальська'),
  ja: pack('Японский', 'Japanese', 'Japonés', 'Japanisch', 'Japonais', 'Japonês', 'Giapponese', '日语', '日本語', '일본어', 'Japonca', 'Japoński', 'Японська'),
  ko: pack('Корейский', 'Korean', 'Coreano', 'Koreanisch', 'Coréen', 'Coreano', 'Coreano', '韩语', '韓国語', '한국어', 'Korece', 'Koreański', 'Корейська'),
  ar: pack('Арабский', 'Arabic', 'Árabe', 'Arabisch', 'Arabe', 'Árabe', 'Arabo', '阿拉伯语', 'アラビア語', '아랍어', 'Arapça', 'Arabski', 'Арабська'),
  tr: pack('Турецкий', 'Turkish', 'Turco', 'Türkisch', 'Turc', 'Turco', 'Turco', '土耳其语', 'トルコ語', '튀르키예어', 'Türkçe', 'Turecki', 'Турецька'),
  pl: pack('Польский', 'Polish', 'Polaco', 'Polnisch', 'Polonais', 'Polonês', 'Polacco', '波兰语', 'ポーランド語', '폴란드어', 'Lehçe', 'Polski', 'Польська'),
  uk: pack('Украинский', 'Ukrainian', 'Ucraniano', 'Ukrainisch', 'Ukrainien', 'Ucraniano', 'Ucraino', '乌克兰语', 'ウクライナ語', '우크라이나어', 'Ukraynaca', 'Ukraiński', 'Українська'),
  nl: pack('Нидерландский', 'Dutch', 'Neerlandés', 'Niederländisch', 'Néerlandais', 'Neerlandês', 'Olandese', '荷兰语', 'オランダ語', '네덜란드어', 'Felemenkçe', 'Niderlandzki', 'Нідерландська'),
  sv: pack('Шведский', 'Swedish', 'Sueco', 'Schwedisch', 'Suédois', 'Sueco', 'Svedese', '瑞典语', 'スウェーデン語', '스웨덴어', 'İsveççe', 'Szwedzki', 'Шведська'),
  el: pack('Греческий', 'Greek', 'Griego', 'Griechisch', 'Grec', 'Grego', 'Greco', '希腊语', 'ギリシャ語', '그리스어', 'Yunanca', 'Grecki', 'Грецька'),
  hi: pack('Хинди', 'Hindi', 'Hindi', 'Hindi', 'Hindi', 'Hindi', 'Hindi', '印地语', 'ヒンディー語', '힌디어', 'Hintçe', 'Hindi', 'Гінді'),
}

/** Adverbial form used after «Произнести», «Вимовити», «Wymów po». */
const SPEAK_RU: Record<StudyId, string> = {
  it: 'по-итальянски',
  de: 'по-немецки',
  ru: 'по-русски',
  zh: 'по-китайски',
  en: 'по-английски',
  es: 'по-испански',
  fr: 'по-французски',
  pt: 'по-португальски',
  ja: 'по-японски',
  ko: 'по-корейски',
  ar: 'по-арабски',
  tr: 'по-турецки',
  pl: 'по-польски',
  uk: 'по-украински',
  nl: 'по-нидерландски',
  sv: 'по-шведски',
  el: 'по-гречески',
  hi: 'на хинди',
}

const SPEAK_UK: Record<StudyId, string> = {
  it: 'італійською',
  de: 'німецькою',
  ru: 'російською',
  zh: 'китайською',
  en: 'англійською',
  es: 'іспанською',
  fr: 'французькою',
  pt: 'португальською',
  ja: 'японською',
  ko: 'корейською',
  ar: 'арабською',
  tr: 'турецькою',
  pl: 'польською',
  uk: 'українською',
  nl: 'нідерландською',
  sv: 'шведською',
  el: 'грецькою',
  hi: 'гінді',
}

const SPEAK_PL: Record<StudyId, string> = {
  it: 'włosku',
  de: 'niemiecku',
  ru: 'rosyjsku',
  zh: 'chińsku',
  en: 'angielsku',
  es: 'hiszpańsku',
  fr: 'francusku',
  pt: 'portugalsku',
  ja: 'japońsku',
  ko: 'koreańsku',
  ar: 'arabsku',
  tr: 'turecku',
  pl: 'polsku',
  uk: 'ukraińsku',
  nl: 'niderlandzku',
  sv: 'szwedzku',
  el: 'grecku',
  hi: 'hindi',
}

export function studyName(locale: Locale, presetId: string | null | undefined, fallback: string): string {
  if (!presetId || !(presetId in STUDY_NAMES)) return fallback
  return STUDY_NAMES[presetId as StudyId][locale]
}

export function speakPhrase(locale: Locale, presetId: string | null | undefined, generic: string): string {
  if (!presetId || !(presetId in STUDY_NAMES)) return generic
  const id = presetId as StudyId
  const name = STUDY_NAMES[id][locale]
  switch (locale) {
    case 'ru':
      return `Произнести ${SPEAK_RU[id]}`
    case 'uk':
      return `Вимовити ${SPEAK_UK[id]}`
    case 'pl':
      return `Wymów po ${SPEAK_PL[id]}`
    case 'en':
      return `Speak ${name}`
    case 'es':
      return `Pronunciar en ${name.toLocaleLowerCase('es')}`
    case 'de':
      return `${name} vorlesen`
    case 'fr':
      return `Prononcer en ${name.toLocaleLowerCase('fr')}`
    case 'pt':
      return `Pronunciar em ${name.toLocaleLowerCase('pt')}`
    case 'it':
      return `Pronuncia in ${name.toLocaleLowerCase('it')}`
    case 'zh':
      return `朗读${name}`
    case 'ja':
      return `${name}で読み上げ`
    case 'ko':
      return `${name}로 읽기`
    case 'tr':
      return `${name} seslendir`
    default:
      return generic
  }
}

const SAMPLE_TERMS: Record<StudyId, readonly [string, string, string]> = {
  it: ['lavorare', 'ciao', 'grazie'],
  de: ['arbeiten', 'hallo', 'danke'],
  ru: ['работать', 'привет', 'спасибо'],
  zh: ['工作', '你好', '谢谢'],
  en: ['work', 'hello', 'thanks'],
  es: ['trabajar', 'hola', 'gracias'],
  fr: ['travailler', 'bonjour', 'merci'],
  pt: ['trabalhar', 'olá', 'obrigado'],
  ja: ['働く', 'こんにちは', 'ありがとう'],
  ko: ['일하다', '안녕', '고마워'],
  ar: ['يعمل', 'مرحبا', 'شكرا'],
  tr: ['çalışmak', 'merhaba', 'teşekkürler'],
  pl: ['pracować', 'cześć', 'dzięki'],
  uk: ['працювати', 'привіт', 'дякую'],
  nl: ['werken', 'hallo', 'dank je'],
  sv: ['arbeta', 'hej', 'tack'],
  el: ['δουλεύω', 'γεια', 'ευχαριστώ'],
  hi: ['काम करना', 'नमस्ते', 'धन्यवाद'],
}

const SAMPLE_GLOSS: readonly [Record<Locale, string>, Record<Locale, string>, Record<Locale, string>] = [
  pack('работать', 'to work', 'trabajar', 'arbeiten', 'travailler', 'trabalhar', 'lavorare', '工作', '働く', '일하다', 'çalışmak', 'pracować', 'працювати'),
  pack('привет', 'hello', 'hola', 'hallo', 'bonjour', 'olá', 'ciao', '你好', 'こんにちは', '안녕', 'merhaba', 'cześć', 'привіт'),
  pack('спасибо', 'thanks', 'gracias', 'danke', 'merci', 'obrigado', 'grazie', '谢谢', 'ありがとう', '고마워', 'teşekkürler', 'dzięki', 'дякую'),
]

export type WordSample = { term: string; translation: string }

/** One example word in the subject language, with its gloss in the interface language. */
export function studySamples(locale: Locale, presetId: string | null | undefined): [WordSample, WordSample, WordSample] {
  const terms = isStudyId(presetId) ? SAMPLE_TERMS[presetId] : null
  return SAMPLE_GLOSS.map((gloss, index) => ({
    term: terms ? terms[index] : gloss[locale],
    translation: gloss[locale],
  })) as [WordSample, WordSample, WordSample]
}

function isStudyId(value: string | null | undefined): value is StudyId {
  return Boolean(value && value in STUDY_NAMES)
}

function pack(
  ru: string,
  en: string,
  es: string,
  de: string,
  fr: string,
  pt: string,
  it: string,
  zh: string,
  ja: string,
  ko: string,
  tr: string,
  pl: string,
  uk: string,
): Record<Locale, string> {
  return { ru, en, es, de, fr, pt, it, zh, ja, ko, tr, pl, uk }
}
