import type { Metadata } from "next"

export const SITE_NAME = "QuakeClub"
export const SITE_URL = "https://quakeclub.com"
export const SITE_TITLE = "QuakeClub - Comunidad de Quake Live en Chile"
export const SITE_DESCRIPTION =
  "La comunidad competitiva de Quake Live en Chile. Rankings ELO en tiempo real, clanes, torneos, noticias, historial de partidas, servidores y configs."

export const SITE_KEYWORDS = [
  "quake live",
  "quake",
  "quakeclub",
  "chile",
  "latinoamerica",
  "esports",
  "arena shooter",
  "clan arena",
  "duel",
  "rankings elo",
  "estadisticas",
  "torneos",
  "clanes",
  "configs",
  "servidores quake live",
]

export const DEFAULT_OG_IMAGE = {
  url: "/branding/ogg.jpg",
  width: 1200,
  height: 630,
  alt: "QuakeClub - Copa Clan Arena, rankings y comunidad de Quake Live en Chile",
}

const SEO_DESCRIPTION_MAX_LENGTH = 160

type SeoImage = {
  url: string
  width?: number
  height?: number
  alt?: string
}

type OpenGraphType = "website" | "article" | "profile"

interface BuildMetadataInput {
  title: string
  description: string
  path: string
  image?: SeoImage | null
  type?: OpenGraphType
  keywords?: string[]
  noIndex?: boolean
  twitterCard?: "summary" | "summary_large_image"
  publishedTime?: string
  authors?: string[]
  section?: string
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export function getSeoTitle(title: string) {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
}

export function truncateSeoText(text: string, maxLength = SEO_DESCRIPTION_MAX_LENGTH) {
  const normalized = text.replace(/\s+/g, " ").trim()

  if (normalized.length <= maxLength) {
    return normalized
  }

  const truncated = normalized.slice(0, maxLength - 1)
  const lastSpace = truncated.lastIndexOf(" ")

  return `${(lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trim()}…`
}

export function resolveSeoImage(image?: SeoImage | null, fallbackAlt?: string): SeoImage {
  if (!image) {
    return {
      ...DEFAULT_OG_IMAGE,
      alt: fallbackAlt || DEFAULT_OG_IMAGE.alt,
    }
  }

  return {
    url: image.url,
    width: image.width ?? DEFAULT_OG_IMAGE.width,
    height: image.height ?? DEFAULT_OG_IMAGE.height,
    alt: image.alt ?? fallbackAlt ?? DEFAULT_OG_IMAGE.alt,
  }
}

export function buildMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  keywords = [],
  noIndex = false,
  twitterCard,
  publishedTime,
  authors,
  section,
}: BuildMetadataInput): Metadata {
  const socialTitle = getSeoTitle(title)
  const socialImage = resolveSeoImage(image, socialTitle)
  const normalizedDescription = truncateSeoText(description)
  const socialImageUrl = absoluteUrl(socialImage.url)
  const mergedKeywords = [...new Set([...SITE_KEYWORDS, ...keywords])]
  const card =
    twitterCard ?? ((socialImage.width ?? DEFAULT_OG_IMAGE.width) >= 1000 ? "summary_large_image" : "summary")

  return {
    title,
    description: normalizedDescription,
    keywords: mergedKeywords,
    alternates: {
      canonical: path,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : undefined,
    openGraph: {
      type,
      url: path,
      title: socialTitle,
      description: normalizedDescription,
      siteName: SITE_NAME,
      locale: "es_CL",
      images: [
        {
          ...socialImage,
          url: socialImageUrl,
        },
      ],
      ...(publishedTime ? { publishedTime } : {}),
      ...(authors?.length ? { authors } : {}),
      ...(section ? { section } : {}),
    },
    twitter: {
      card,
      title: socialTitle,
      description: normalizedDescription,
      images: [socialImageUrl],
    },
  }
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "es-CL",
    publisher: {
      "@id": `${SITE_URL}#organization`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/browser?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icons/icon-512.png"),
    image: absoluteUrl(DEFAULT_OG_IMAGE.url),
    description: SITE_DESCRIPTION,
    sameAs: [
      "https://discord.gg/JKDWykm2Jy",
      "https://www.youtube.com/@QuakeClubCL",
      "https://www.twitch.tv/quakeclubcl",
    ],
  }
}

export function buildNewsArticleJsonLd({
  title,
  description,
  path,
  image,
  author,
  publishedAt,
}: {
  title: string
  description: string
  path: string
  image?: string | null
  author: string
  publishedAt: string
}) {
  const socialImage = resolveSeoImage(image ? { url: image, alt: title } : null, title)

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    image: [absoluteUrl(socialImage.url)],
    datePublished: publishedAt,
    dateModified: publishedAt,
    mainEntityOfPage: absoluteUrl(path),
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@id": `${SITE_URL}#organization`,
    },
  }
}
