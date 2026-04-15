export interface NewsItem {
  id: string
  slug?: string  // URL-friendly identifier, e.g., "prc-campeon-copa-clan-arena-2025"
  title: string
  date: string
  excerpt: string
  content: string
  author: string
  image?: string
  imageUrl?: string
  contentImages?: Record<string, string>
}
