// Configuración de internacionalización (ES y EN únicamente)
export const locales = ['es', 'en'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'es'

export const localeNames: Record<Locale, string> = {
  es: 'Español',
  en: 'English'
}

export const localeFlags: Record<Locale, string> = {
  es: '🇨🇱',
  en: '🇺🇸'
}

// Códigos de país para las banderas (flag-icons)
export const localeFlagCodes: Record<Locale, string> = {
  es: 'cl',
  en: 'us'
}
