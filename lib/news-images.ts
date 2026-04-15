import type { NewsItem } from "@/types/news"

export function isDataImageUrl(value?: string | null): value is string {
  return typeof value === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value)
}

export function parseDataImageUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.+)$/)
  if (!match) {
    return null
  }

  const [, mimeType, base64Data] = match

  return {
    mimeType,
    buffer: Buffer.from(base64Data, "base64"),
  }
}

export function getNewsImagePath(news: Pick<NewsItem, "id" | "slug" | "image">) {
  if (!news.image) {
    return undefined
  }

  if (isDataImageUrl(news.image)) {
    return `/api/news/${news.slug || news.id}/image`
  }

  return news.image
}
