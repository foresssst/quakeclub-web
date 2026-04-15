import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

export default getRequestConfig(async () => {
  // Intentar obtener locale de cookie
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined

  if (cookieLocale && locales.includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default
    }
  }

  // Detectar del header Accept-Language
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') || ''

  // Parsear Accept-Language header
  const browserLocales = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale] = lang.trim().split(';')
      return locale.split('-')[0].toLowerCase()
    })

  // Encontrar el primer locale soportado
  const detectedLocale = browserLocales.find(lang =>
    locales.includes(lang as Locale)
  ) as Locale | undefined

  const locale = detectedLocale || defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  }
})
