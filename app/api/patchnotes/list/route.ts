import { NextResponse } from "next/server"
import { getAllPatchNotes } from "@/lib/patchnotes-storage"
import { prisma } from "@/lib/prisma"

// Detectar @steamId en el contenido del patch note
const MENTION_REGEX = /@(7656119\d{10})/g

export async function GET() {
  const notes = getAllPatchNotes()

  // Extraer todos los steamIds mencionados en el contenido
  const allSteamIds = new Set<string>()
  for (const note of notes) {
    let match
    const regex = new RegExp(MENTION_REGEX.source, "g")
    while ((match = regex.exec(note.content)) !== null) {
      allSteamIds.add(match[1])
    }
  }

  if (allSteamIds.size > 0) {
    const players = await prisma.player.findMany({
      where: { steamId: { in: [...allSteamIds] } },
      select: { steamId: true, username: true, avatar: true },
    })

    const playerMap = new Map(players.map((p) => [p.steamId, p]))

    // Agregar mentions resueltas a cada nota
    for (const note of notes) {
      const mentions: { steamId: string; name: string; avatar?: string }[] = []
      const seen = new Set<string>()
      let match
      const regex = new RegExp(MENTION_REGEX.source, "g")
      while ((match = regex.exec(note.content)) !== null) {
        const steamId = match[1]
        if (!seen.has(steamId)) {
          seen.add(steamId)
          const player = playerMap.get(steamId)
          mentions.push({
            steamId,
            name: player?.username || steamId,
            avatar: player?.avatar || undefined,
          })
        }
      }
      if (mentions.length > 0) {
        ;(note as any).mentions = mentions
      }
    }
  }

  return NextResponse.json({ notes })
}
