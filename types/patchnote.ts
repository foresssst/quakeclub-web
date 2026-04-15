export interface PatchNoteMention {
  steamId: string
  name: string
  avatar?: string
}

export interface PatchNote {
  id: string
  version: string      // e.g., "1.4.0"
  title: string
  date: string         // YYYY-MM-DD
  content: string      // Markdown — usa @steamId para mencionar jugadores
  author: string
  mentions?: PatchNoteMention[]  // Resuelto por la API
}
