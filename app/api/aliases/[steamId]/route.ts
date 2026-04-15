import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSteamId } from "@/lib/security"
import fs from "fs"
import path from "path"
const DATA_PATH = path.join(process.cwd(), "data", "aliases.json")
function loadAliases() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"))
  } catch {
    return {}
  }
}
function saveAliases(data: any) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8")
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ steamId: string }> }) {
  try {
    const { steamId } = await params
    if (!steamId) {
      return NextResponse.json({ error: "Steam ID is required" }, { status: 400 })
    }
    if (!validateSteamId(steamId)) {
      return NextResponse.json({ error: "Invalid Steam ID format" }, { status: 400 })
    }
    console.log("[Aliases API] Fetching aliases for steamId:", steamId)
    let allAliases: any[] = []
    let source = "none"
    // 1. PRIORIDAD: Intentar obtener desde nuestra base de datos Prisma
    try {
      const dbAliases = await prisma.playerAlias.findMany({
        where: { steamId },
        orderBy: { lastSeen: "desc" },
      })
      if (dbAliases.length > 0) {
        console.log("[Aliases API] Found", dbAliases.length, "aliases in QuakeClub database")
        allAliases = dbAliases.map((dbAlias: any) => ({
          alias: dbAlias.alias,
          firstSeen: dbAlias.firstSeen,
          lastSeen: dbAlias.lastSeen,
          timesUsed: dbAlias.timesUsed,
        }))
        source = "quakeclub"
      }
    } catch (dbError) {
      console.error("[Aliases API] Error fetching from database:", dbError)
    }
    // Fallbacks deshabilitados - solo usar base de datos QuakeClub
    // Los aliases se trackean automáticamente desde los partidos ZMQ
    console.log("[Aliases API] Total aliases:", allAliases.length, "from source:", source)
    return NextResponse.json({
      success: true,
      steamId,
      aliases: allAliases,
      totalAliases: allAliases.length,
      source,
    })
  } catch (error) {
    console.error("[Aliases API] Error fetching aliases:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}
// --- POST handler para recibir aliases desde el plugin minqlx ---
export async function POST(request: NextRequest, { params }: { params: Promise<{ steamId: string }> }) {
  try {
    const apiKey = request.headers.get("x-api-key")
    const expectedApiKey = process.env.MINQLX_API_KEY
    if (!expectedApiKey) {
      console.error("[Aliases API] MINQLX_API_KEY no configurada en variables de entorno")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }
    if (apiKey !== expectedApiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const { steamId } = await params
    const aliases = Array.isArray(body.aliases) ? body.aliases : []
    console.log(`[Aliases API] Recibiendo ${aliases.length} aliases para Steam ID: ${steamId}`)
    // Intentar guardar en Prisma (para usuarios registrados)
    try {
      // Verificar si el jugador existe (está registrado)
      let player = await prisma.player.findUnique({
        where: { steamId },
      })
      // Si no existe, crearlo
      if (!player) {
        console.log(`[Aliases API] Creando nuevo jugador para Steam ID: ${steamId}`)
        const playerId = `player_${steamId}_${Date.now()}`
        player = await prisma.player.create({
          data: {
            id: playerId,
            steamId,
            username: aliases[0] || `Player_${steamId.slice(-8)}`,
            updatedAt: new Date(),
          },
        })
      }
      // Procesar cada alias
      const now = new Date()
      let aliasesCreated = 0
      let aliasesUpdated = 0
      for (const aliasName of aliases) {
        if (!aliasName || typeof aliasName !== "string") continue
        // Buscar si el alias ya existe para este Steam ID
        const existingAlias = await prisma.playerAlias.findUnique({
          where: {
            steamId_alias: {
              steamId,
              alias: aliasName,
            },
          },
        })
        if (existingAlias) {
          // Actualizar lastSeen y timesUsed
          await prisma.playerAlias.update({
            where: { id: existingAlias.id },
            data: {
              lastSeen: now,
              timesUsed: { increment: 1 },
            },
          })
          aliasesUpdated++
        } else {
          // Crear nuevo alias
          const aliasId = `alias_${steamId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          await prisma.playerAlias.create({
            data: {
              id: aliasId,
              playerId: player.id,
              steamId,
              alias: aliasName,
              firstSeen: now,
              lastSeen: now,
              timesUsed: 1,
            },
          })
          aliasesCreated++
        }
      }
      console.log(
        `[Aliases API] ✓ Aliases guardados en Prisma: ${aliasesCreated} nuevos, ${aliasesUpdated} actualizados`,
      )
      return NextResponse.json({
        success: true,
        saved: "database",
        aliasesCreated,
        aliasesUpdated,
        playerId: player.id,
      })
    } catch (prismaError) {
      // Si falla Prisma, guardar en JSON como fallback
      console.error("[Aliases API] Error con Prisma, guardando en JSON:", prismaError)
      const allAliases = loadAliases()
      allAliases[steamId] = aliases
      saveAliases(allAliases)
      return NextResponse.json({
        success: true,
        saved: "json_fallback",
        error: prismaError instanceof Error ? prismaError.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("[Aliases API] Error general:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}
