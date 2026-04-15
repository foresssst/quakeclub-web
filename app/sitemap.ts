import type { MetadataRoute } from "next"

import { prisma } from "@/lib/prisma"
import { getAllNews } from "@/lib/news-storage"
import { SITE_URL, absoluteUrl } from "@/lib/seo"

export const revalidate = 3600

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>

function staticEntry(
  path: string,
  changeFrequency: ChangeFrequency,
  priority: number,
  lastModified = new Date(),
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [clans, tournaments, recentMatches] = await Promise.all([
    prisma.clan.findMany({
      where: {
        slug: {
          not: null,
        },
      },
      select: {
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.tournament.findMany({
      select: {
        id: true,
        slug: true,
        startsAt: true,
        updatedAt: true,
        status: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.match.findMany({
      select: {
        id: true,
        matchId: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 500,
    }),
  ])

  const news = getAllNews()
  const now = new Date()

  return [
    staticEntry("/", "daily", 1, now),
    staticEntry("/rankings", "hourly", 0.95, now),
    staticEntry("/ladder", "hourly", 0.95, now),
    staticEntry("/clanes", "daily", 0.9, now),
    staticEntry("/clanes/rankings", "daily", 0.86, now),
    staticEntry("/browser", "hourly", 0.85, now),
    staticEntry("/historial", "daily", 0.82, now),
    staticEntry("/esport", "daily", 0.8, now),
    staticEntry("/noticias", "daily", 0.8, now),
    staticEntry("/configs", "weekly", 0.72, now),
    staticEntry("/academia", "weekly", 0.7, now),
    staticEntry("/foro", "daily", 0.68, now),
    staticEntry("/patchnotes", "weekly", 0.64, now),
    staticEntry("/about", "monthly", 0.42, now),
    staticEntry("/reglas", "monthly", 0.4, now),
    staticEntry("/contacto", "monthly", 0.34, now),
    staticEntry("/terminos", "yearly", 0.18, now),
    staticEntry("/privacidad", "yearly", 0.18, now),
    ...news.map((item) => ({
      url: absoluteUrl(`/noticias/${item.slug || item.id}`),
      lastModified: new Date(item.date),
      changeFrequency: "monthly" as const,
      priority: 0.78,
    })),
    ...clans
      .filter((clan) => Boolean(clan.slug))
      .map((clan) => ({
        url: absoluteUrl(`/clanes/${clan.slug}`),
        lastModified: clan.updatedAt || clan.createdAt,
        changeFrequency: "weekly" as const,
        priority: 0.72,
      })),
    ...tournaments.map((tournament) => ({
      url: absoluteUrl(`/esport/${tournament.slug || tournament.id}`),
      lastModified: tournament.updatedAt || tournament.startsAt || now,
      changeFrequency: tournament.status === "IN_PROGRESS" ? ("daily" as const) : ("weekly" as const),
      priority: tournament.status === "IN_PROGRESS" ? 0.84 : 0.74,
    })),
    ...recentMatches.map((match) => ({
      url: absoluteUrl(`/match/${match.matchId || match.id}`),
      lastModified: match.timestamp,
      changeFrequency: "daily" as const,
      priority: 0.62,
    })),
  ]
}
