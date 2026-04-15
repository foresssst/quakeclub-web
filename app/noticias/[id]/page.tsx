import type { Metadata } from "next"
import { getNewsById } from "@/lib/news-storage"
import NoticiaContent from "@/components/noticia-content"
import { StructuredData } from "@/components/structured-data"
import { buildMetadata, buildNewsArticleJsonLd, resolveSeoImage } from "@/lib/seo"
import { getNewsImagePath } from "@/lib/news-images"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const news = getNewsById(id)

  if (!news) {
    return {
      title: "Noticia no encontrada",
      robots: {
        index: false,
        follow: false,
      },
    }
  }

  const socialImage = getNewsImagePath(news)

  return buildMetadata({
    title: news.title,
    description: news.excerpt,
    path: `/noticias/${news.slug || news.id}`,
    type: "article",
    image: socialImage ? resolveSeoImage({ url: socialImage, alt: news.title }) : null,
    publishedTime: news.date,
    authors: [news.author],
    section: "Noticias",
    keywords: ["noticia", "torneos", "comunidad quake live"],
  })
}

export default async function NoticiaPage({ params }: PageProps) {
  const { id } = await params
  const news = getNewsById(id)

  return (
    <>
      {news ? (
        <StructuredData
          id="news-article-jsonld"
          data={buildNewsArticleJsonLd({
            title: news.title,
            description: news.excerpt,
            path: `/noticias/${news.slug || news.id}`,
            image: getNewsImagePath(news),
            author: news.author,
            publishedAt: news.date,
          })}
        />
      ) : null}
      <NoticiaContent />
    </>
  )
}
