import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Quake Live App ID
const QUAKE_LIVE_APPID = 282440

interface SteamServer {
  addr: string
  gameport: number
  steamid: string
  name: string
  appid: number
  gamedir: string
  version: string
  product: string
  region: number
  players: number
  max_players: number
  bots: number
  map: string
  secure: boolean
  dedicated: boolean
  os: string
  gametype: string
}

interface SteamApiResponse {
  response: {
    servers: SteamServer[]
  }
}

// Cache para evitar llamadas excesivas a Steam API
let cachedServers: any[] = []
let cacheTimestamp = 0
const CACHE_DURATION = 30000 // 30 segundos

// Extract clean game type from Steam gametype string
function extractGameType(gametype: string): string {
  const types = gametype.toLowerCase().split(",")

  // Priority list of game types
  const priorityTypes = ["clanarena", "ca", "duel", "ctf", "tdm", "ffa", "race", "ft", "redrover", "infected", "instagib"]

  for (const pType of priorityTypes) {
    if (types.some(t => t.trim() === pType)) {
      // Return clean format
      switch (pType) {
        case "clanarena": return "CA"
        case "ca": return "CA"
        case "duel": return "DUEL"
        case "ctf": return "CTF"
        case "tdm": return "TDM"
        case "ffa": return "FFA"
        case "race": return "RACE"
        case "ft": return "FT"
        case "redrover": return "RT"
        case "infected": return "RT"
        case "instagib": return "INSTAGIB"
        default: return pType.toUpperCase()
      }
    }
  }

  // Return first type if no priority match
  return types[0]?.trim().toUpperCase() || "UNKNOWN"
}

async function fetchServersFromSteam(serverIps: string[]): Promise<any[]> {
  const steamApiKey = process.env.STEAM_API_KEY
  if (!steamApiKey) {
    console.error("[Steam API] No STEAM_API_KEY configured")
    return []
  }

  const allServers: any[] = []

  // Consultar Steam API por cada IP
  for (const ip of serverIps) {
    try {
      // Filter format: \appid\282440\addr\IP
      const filter = `\\appid\\${QUAKE_LIVE_APPID}\\addr\\${ip}`
      const url = `https://api.steampowered.com/IGameServersService/GetServerList/v1/?key=${steamApiKey}&filter=${encodeURIComponent(filter)}&limit=50`

      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        cache: "no-store",
      })

      if (!response.ok) {
        console.error(`[Steam API] Error fetching servers for ${ip}: ${response.status}`)
        continue
      }

      const data: SteamApiResponse = await response.json()

      if (data.response?.servers) {
        allServers.push(...data.response.servers)
      }
    } catch (error) {
      console.error(`[Steam API] Error fetching ${ip}:`, error)
    }
  }

  return allServers
}

export async function GET() {
  try {
    // Check cache
    const now = Date.now()
    if (cachedServers.length > 0 && now - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json(cachedServers, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      })
    }

    // Obtener IPs únicas de la configuración
    const serverConfigs = await prisma.zmqServerConfig.findMany({
      where: { enabled: true },
      select: { ip: true, name: true },
    })

    const uniqueIps = [...new Set(serverConfigs.map((s) => s.ip))]

    // Fetch from Steam API
    const steamServers = await fetchServersFromSteam(uniqueIps)

    // Transform to our format
    const servers = steamServers.map((server) => {
      const [ip, portStr] = server.addr.split(":")
      const port = parseInt(portStr) || server.gameport

      // Extract primary game type from gametype string
      const gameTypeRaw = server.gametype || ""
      const gameType = extractGameType(gameTypeRaw)

      return {
        ip,
        port,
        name: server.name || `Server ${server.addr}`,
        map: server.map || "",
        gameType,
        players: server.players || 0,
        playerList: [], // Steam API no da lista de jugadores
        maxplayers: server.max_players || 16,
        status: "online",
      }
    }).sort((a, b) => b.players - a.players)

    // Update cache
    cachedServers = servers
    cacheTimestamp = now

    return NextResponse.json(servers, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error) {
    console.error("[API] Error fetching server status:", error)
    return NextResponse.json(cachedServers.length > 0 ? cachedServers : [], {
      status: cachedServers.length > 0 ? 200 : 500,
    })
  }
}
