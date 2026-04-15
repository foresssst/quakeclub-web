import fs from "fs"
import path from "path"
import type { NewsItem } from "@/types/news"
import { safeJsonParse, logSecurityEvent } from "./security"
import { generateNewsSlug } from "./slug"

const DATA_DIR = path.join(process.cwd(), "data")
const NEWS_FILE = path.join(DATA_DIR, "news.json")

// Verifica que el directorio de datos exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Carga las noticias desde el archivo
export function loadNews(): NewsItem[] {
  try {
    if (fs.existsSync(NEWS_FILE)) {
      const data = fs.readFileSync(NEWS_FILE, "utf-8")
      if (!data || data.trim().length === 0) {
        return []
      }
      return safeJsonParse<NewsItem[]>(data, [])
    }
  } catch (error) {
    logSecurityEvent("NEWS_LOAD_ERROR", { error: String(error) })
    console.error("Error loading news:", error)
  }
  return []
}

// Guarda las noticias en el archivo
export function saveNews(news: NewsItem[]) {
  try {
    fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2))
  } catch (error) {
    console.error("Error saving news:", error)
    throw error
  }
}

// Obtiene todas las noticias ordenadas por fecha
export function getAllNews(): NewsItem[] {
  return loadNews().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Obtiene una noticia específica por ID o slug
export function getNewsById(idOrSlug: string): NewsItem | null {
  const news = loadNews()
  // Buscar primero por slug, luego por id
  return news.find((item) => item.slug === idOrSlug || item.id === idOrSlug) || null
}

// Obtiene una noticia por slug solamente
export function getNewsBySlug(slug: string): NewsItem | null {
  const news = loadNews()
  return news.find((item) => item.slug === slug) || null
}

// Obtiene todos los slugs existentes
export function getAllNewsSlugs(): string[] {
  return loadNews()
    .filter((item) => item.slug)
    .map((item) => item.slug as string)
}

// Crea una nueva noticia
export function createNews(newsItem: Omit<NewsItem, "id">): NewsItem {
  const news = loadNews()
  const id = `news-${Date.now()}`
  
  // Generar slug automáticamente si no se proporciona
  const existingSlugs = getAllNewsSlugs()
  const slug = newsItem.slug || generateNewsSlug(newsItem.title, existingSlugs)
  
  const newItem: NewsItem = { ...newsItem, id, slug }
  news.push(newItem)
  saveNews(news)
  return newItem
}

// Actualiza una noticia existente
export function updateNews(id: string, updates: Partial<NewsItem>): NewsItem | null {
  const news = loadNews()
  const index = news.findIndex((item) => item.id === id)
  if (index === -1) return null

  news[index] = { ...news[index], ...updates, id }
  saveNews(news)
  return news[index]
}

// Elimina una noticia por ID
export function deleteNews(id: string): boolean {
  const news = loadNews()
  const filtered = news.filter((item) => item.id !== id)
  if (filtered.length === news.length) return false

  saveNews(filtered)
  return true
}
