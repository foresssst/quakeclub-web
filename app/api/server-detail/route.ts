import { NextRequest, NextResponse } from "next/server"
import * as dgram from "dgram"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// A2S Protocol constants
const HEADER = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF])
const A2S_INFO = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00])
const A2S_PLAYER = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x55, 0xFF, 0xFF, 0xFF, 0xFF])
const A2S_RULES = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x56, 0xFF, 0xFF, 0xFF, 0xFF])

interface Player {
  name: string
  score: number
  duration: number
  // Enhanced from DB
  steamId?: string
  odaId?: string
  avatar?: string
  elo?: number
  country?: string
  clan?: {
    tag: string
    name: string
    avatarUrl: string | null
    slug: string | null
  }
}

interface ServerDetail {
  ip: string
  port: number
  ping: number
  // A2S_INFO
  name: string
  map: string
  game: string
  gameType: string
  players: number
  maxPlayers: number
  bots: number
  serverType: string
  os: string
  hasPassword: boolean
  vac: boolean
  version: string
  keywords: string
  // A2S_RULES (relevant ones)
  teamScores?: { red: number; blue: number }
  timelimit?: number
  fraglimit?: number
  roundlimit?: number
  gameState?: string
  // A2S_PLAYER
  playerList: Player[]
}

// Read null-terminated string from buffer
function readString(buffer: Buffer, offset: number): { value: string; newOffset: number } {
  let end = offset
  while (end < buffer.length && buffer[end] !== 0) end++
  return {
    value: buffer.slice(offset, end).toString("utf8"),
    newOffset: end + 1
  }
}

// Query with challenge handling
// isInfoQuery: A2S_INFO appends challenge to end, others replace last 4 bytes
async function queryWithChallenge(ip: string, port: number, initialPacket: Buffer, timeout: number, isInfoQuery: boolean = false): Promise<{ data: Buffer; ping: number }> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4")
    const startTime = Date.now()
    let resolved = false

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        client.close()
        reject(new Error("Timeout"))
      }
    }, timeout)

    client.on("message", (msg) => {
      if (resolved) return

      // Check for challenge response (0x41)
      if (msg.length >= 9 && msg[4] === 0x41) {
        // Extract challenge and resend
        const challenge = msg.slice(5, 9)
        let request: Buffer

        if (isInfoQuery) {
          // For A2S_INFO: append challenge to end of full packet
          request = Buffer.concat([initialPacket, challenge])
        } else {
          // For A2S_PLAYER/A2S_RULES: replace last 4 bytes (placeholder) with challenge
          request = Buffer.concat([
            initialPacket.slice(0, 5),
            challenge
          ])
        }
        client.send(request, port, ip)
        return
      }

      // Got actual data
      resolved = true
      clearTimeout(timeoutId)
      const ping = Date.now() - startTime
      client.close()
      resolve({ data: msg, ping })
    })

    client.on("error", (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        client.close()
        reject(err)
      }
    })

    client.send(initialPacket, port, ip)
  })
}

// Parse A2S_INFO response
function parseInfo(buffer: Buffer): Partial<ServerDetail> {
  if (buffer.length < 6 || buffer[4] !== 0x49) {
    return {}
  }

  try {
    let offset = 5
    const protocol = buffer.readUInt8(offset++)

    const nameResult = readString(buffer, offset)
    offset = nameResult.newOffset

    const mapResult = readString(buffer, offset)
    offset = mapResult.newOffset

    const folderResult = readString(buffer, offset)
    offset = folderResult.newOffset

    const gameResult = readString(buffer, offset)
    offset = gameResult.newOffset

    const appId = buffer.readUInt16LE(offset)
    offset += 2

    const players = buffer.readUInt8(offset++)
    const maxPlayers = buffer.readUInt8(offset++)
    const bots = buffer.readUInt8(offset++)

    const serverTypeByte = buffer.readUInt8(offset++)
    const serverType = serverTypeByte === 0x64 ? "Dedicated" : serverTypeByte === 0x6C ? "Listen" : "Proxy"

    const osByte = buffer.readUInt8(offset++)
    const os = osByte === 0x6C ? "Linux" : osByte === 0x77 ? "Windows" : "Mac"

    const hasPassword = buffer.readUInt8(offset++) === 1
    const vac = buffer.readUInt8(offset++) === 1

    const versionResult = readString(buffer, offset)
    offset = versionResult.newOffset

    let keywords = ""
    if (offset < buffer.length) {
      const edf = buffer.readUInt8(offset++)

      if ((edf & 0x80) > 0) offset += 2 // port
      if ((edf & 0x10) > 0) offset += 8 // steamId
      if ((edf & 0x40) > 0) {
        offset += 2 // sourceTV port
        const stvName = readString(buffer, offset)
        offset = stvName.newOffset
      }
      if ((edf & 0x20) > 0) {
        const keywordsResult = readString(buffer, offset)
        keywords = keywordsResult.value
      }
    }

    // Extract game type from keywords
    let gameType = "UNKNOWN"
    if (keywords) {
      const types = keywords.toLowerCase().split(",")
      const priorityTypes = ["clanarena", "ca", "duel", "ctf", "tdm", "ffa", "race", "ft", "freezetag", "redrover", "infected"]
      for (const pType of priorityTypes) {
        if (types.some(t => t.trim() === pType)) {
          gameType = pType === "clanarena" ? "CA" : pType === "freezetag" ? "FT" : pType === "redrover" || pType === "infected" ? "RT" : pType.toUpperCase()
          break
        }
      }
    }

    return {
      name: nameResult.value,
      map: mapResult.value,
      game: gameResult.value,
      gameType,
      players,
      maxPlayers,
      bots,
      serverType,
      os,
      hasPassword,
      vac,
      version: versionResult.value,
      keywords,
    }
  } catch {
    return {}
  }
}

// Parse A2S_PLAYER response
function parsePlayers(buffer: Buffer): Player[] {
  const players: Player[] = []

  if (buffer.length < 6 || buffer[4] !== 0x44) {
    return players
  }

  try {
    let offset = 5
    const numPlayers = buffer.readUInt8(offset++)

    for (let i = 0; i < numPlayers && offset < buffer.length; i++) {
      const index = buffer.readUInt8(offset++)

      const nameResult = readString(buffer, offset)
      offset = nameResult.newOffset

      const score = buffer.readInt32LE(offset)
      offset += 4

      const duration = buffer.readFloatLE(offset)
      offset += 4

      if (nameResult.value) {
        players.push({
          name: nameResult.value,
          score,
          duration,
        })
      }
    }
  } catch { }

  return players
}

// Parse A2S_RULES response
function parseRules(buffer: Buffer): Record<string, string> {
  const rules: Record<string, string> = {}

  if (buffer.length < 7 || buffer[4] !== 0x45) {
    return rules
  }

  try {
    let offset = 5
    const numRules = buffer.readUInt16LE(offset)
    offset += 2

    for (let i = 0; i < numRules && offset < buffer.length; i++) {
      const nameResult = readString(buffer, offset)
      offset = nameResult.newOffset

      const valueResult = readString(buffer, offset)
      offset = valueResult.newOffset

      if (nameResult.value) {
        rules[nameResult.value] = valueResult.value
      }
    }
  } catch { }

  return rules
}

// Find players in our database by username or alias
async function enrichPlayersFromDB(players: Player[]): Promise<Player[]> {
  if (players.length === 0) return players

  // Clean player names (remove Quake color codes like ^1, ^7, etc.)
  const cleanNames = players.map(p => p.name.replace(/\^[0-9]/g, '').toLowerCase())

  try {
    // Search by username (case insensitive)
    const dbPlayersByUsername = await prisma.player.findMany({
      where: {
        OR: cleanNames.map(name => ({
          username: { equals: name, mode: "insensitive" as const }
        }))
      },
      select: {
        id: true,
        steamId: true,
        username: true,
        avatar: true,
        countryCode: true,
      }
    })

    // Also search by PlayerAlias
    const aliasList = await prisma.playerAlias.findMany({
      where: {
        OR: cleanNames.map(name => ({
          alias: { equals: name, mode: "insensitive" as const }
        }))
      },
      select: {
        steamId: true,
        alias: true,
        Player: {
          select: {
            id: true,
            steamId: true,
            username: true,
            avatar: true,
            countryCode: true,
          }
        }
      }
    })

    // Build name -> player info map (username takes priority, then alias)
    const nameToPlayer = new Map<string, { id: string; steamId: string; username: string; avatar: string | null; countryCode: string | null }>()

    // First add aliases
    for (const alias of aliasList) {
      if (alias.Player) {
        nameToPlayer.set(alias.alias.toLowerCase(), alias.Player)
      }
    }

    // Then override with username matches (higher priority)
    for (const p of dbPlayersByUsername) {
      nameToPlayer.set(p.username.toLowerCase(), p)
    }

    // Get all unique steamIds
    const allSteamIds = [...new Set([
      ...dbPlayersByUsername.map(p => p.steamId),
      ...aliasList.map(a => a.steamId)
    ])].filter(Boolean)

    // Fetch clan memberships and ratings in parallel
    const [clanMembers, ratings] = await Promise.all([
      allSteamIds.length > 0 ? prisma.clanMember.findMany({
        where: { steamId: { in: allSteamIds } },
        include: { Clan: { select: { tag: true, name: true, avatarUrl: true, slug: true } } }
      }) : [],
      allSteamIds.length > 0 ? prisma.playerRating.findMany({
        where: { steamId: { in: allSteamIds }, gameType: "ca" },
        select: { steamId: true, rating: true }
      }) : []
    ])

    // Create maps
    const clanMap = new Map(clanMembers.map(cm => [cm.steamId, cm.Clan]))
    const ratingMap = new Map(ratings.map(r => [r.steamId, Math.round(r.rating)]))

    // Enrich players
    return players.map(player => {
      const cleanName = player.name.replace(/\^[0-9]/g, '').toLowerCase()
      const dbPlayer = nameToPlayer.get(cleanName)

      if (dbPlayer) {
        const clan = dbPlayer.steamId ? clanMap.get(dbPlayer.steamId) : undefined
        const elo = dbPlayer.steamId ? ratingMap.get(dbPlayer.steamId) : undefined
        return {
          ...player,
          steamId: dbPlayer.steamId || undefined,
          odaId: dbPlayer.id,
          avatar: dbPlayer.avatar || undefined,
          elo: elo,
          country: dbPlayer.countryCode || undefined,
          clan: clan ? {
            tag: clan.tag,
            name: clan.name,
            avatarUrl: clan.avatarUrl,
            slug: clan.slug,
          } : undefined,
        }
      }
      return player
    })
  } catch (error) {
    console.error("[server-detail] Error enriching players:", error)
    return players
  }
}



export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ip = searchParams.get("ip")
  const portStr = searchParams.get("port")

  if (!ip || !portStr) {
    return NextResponse.json({ error: "Missing ip or port" }, { status: 400 })
  }

  const port = parseInt(portStr, 10)
  if (isNaN(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: "Invalid port" }, { status: 400 })
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(ip)) {
    return NextResponse.json({ error: "Invalid IP" }, { status: 400 })
  }

  // Check if this is one of our servers (we have steamId data for these)
  const OUR_SERVER_IPS = (process.env.OUR_SERVER_IPS ?? "").split(",").map((v) => v.trim()).filter(Boolean)
  const isOurServer = OUR_SERVER_IPS.includes(ip)

  const timeout = 3000
  let serverDetail: Partial<ServerDetail> = {
    ip,
    port,
    ping: 0,
    playerList: [],
  }

  // Query A2S_INFO (pass true to indicate this is an INFO query for challenge handling)
  try {
    const infoResult = await queryWithChallenge(ip, port, A2S_INFO, timeout, true)
    serverDetail.ping = infoResult.ping
    const info = parseInfo(infoResult.data)
    serverDetail = { ...serverDetail, ...info }
  } catch (error) {
    console.error("[A2S_INFO] Error:", error)
  }

  // Always use A2S for player list (real-time data)
  try {
    const playerResult = await queryWithChallenge(ip, port, A2S_PLAYER, timeout)
    let players = parsePlayers(playerResult.data)

    // Always enrich from database by username to get avatar, clan, ELO
    players = await enrichPlayersFromDB(players)

    serverDetail.playerList = players
  } catch (error) {
    console.error("[A2S_PLAYER] Error:", error)
  }


  // Query A2S_RULES
  try {
    const rulesResult = await queryWithChallenge(ip, port, A2S_RULES, timeout)
    const rules = parseRules(rulesResult.data)

    // Extract relevant rules for Quake Live
    if (rules.g_redscore || rules.g_bluescore) {
      serverDetail.teamScores = {
        red: parseInt(rules.g_redscore || "0", 10),
        blue: parseInt(rules.g_bluescore || "0", 10),
      }
    }
    if (rules.timelimit) serverDetail.timelimit = parseInt(rules.timelimit, 10)
    if (rules.fraglimit) serverDetail.fraglimit = parseInt(rules.fraglimit, 10)
    if (rules.roundlimit) serverDetail.roundlimit = parseInt(rules.roundlimit, 10)
    if (rules.g_gameState) serverDetail.gameState = rules.g_gameState
  } catch (error) {
    console.error("[A2S_RULES] Error:", error)
  }

  return NextResponse.json(serverDetail, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  })
}
