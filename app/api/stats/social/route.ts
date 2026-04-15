/**
 * API de estadísticas sociales
 * Obtiene contadores de servidores, partidas, Discord, YouTube y Twitch
 * Usa cache de 5 minutos para evitar rate limits de APIs externas
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Cache en memoria para evitar rate limits de APIs externas
let socialCache: {
  data: SocialStats | null
  timestamp: number
} = { data: null, timestamp: 0 }

const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

interface SocialStats {
  serversOnline: number
  discordMembers: number
  youtubeFollowers: number
  twitchFollowers: number
  matchesToday: number
  activePlayers: number
}

// Obtener miembros de Discord usando la API del bot
async function getDiscordMembers(): Promise<number> {
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID

  if (!token || !guildId) {
    return 0 // Fallback si no hay configuración
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}?with_counts=true`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
        next: { revalidate: 300 }, // Cache por 5 minutos
      }
    )

    if (!response.ok) {
      console.error("Discord API error:", response.status)
      return 0
    }

    const data = await response.json()
    return data.approximate_member_count || 0
  } catch (error) {
    console.error("Error fetching Discord members:", error)
    return 0
  }
}

// Obtener suscriptores de YouTube
async function getYoutubeFollowers(): Promise<number> {
  const apiKey = process.env.YOUTUBE_API_KEY
  const channelId = process.env.YOUTUBE_CHANNEL_ID

  if (!apiKey || !channelId) {
    return 0 // Fallback si no hay configuración
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`,
      { next: { revalidate: 300 } }
    )

    if (!response.ok) {
      console.error("YouTube API error:", response.status)
      return 0
    }

    const data = await response.json()
    return parseInt(data.items?.[0]?.statistics?.subscriberCount || "0")
  } catch (error) {
    console.error("Error fetching YouTube followers:", error)
    return 0
  }
}

// Obtener seguidores de Twitch
async function getTwitchFollowers(): Promise<number> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  const channelName = process.env.TWITCH_CHANNEL_NAME

  if (!clientId || !clientSecret || !channelName) {
    return 0 // Fallback si no hay configuración
  }

  try {
    // Primero obtener el token de acceso
    const tokenResponse = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    )

    if (!tokenResponse.ok) {
      console.error("Twitch token error:", tokenResponse.status)
      return 0
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Obtener el ID del usuario
    const userResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${channelName}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!userResponse.ok) {
      console.error("Twitch user error:", userResponse.status)
      return 0
    }

    const userData = await userResponse.json()
    const broadcasterId = userData.data?.[0]?.id

    if (!broadcasterId) {
      return 0
    }

    // Obtener seguidores
    const followersResponse = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!followersResponse.ok) {
      console.error("Twitch followers error:", followersResponse.status)
      return 0
    }

    const followersData = await followersResponse.json()
    return followersData.total || 0
  } catch (error) {
    console.error("Error fetching Twitch followers:", error)
    return 0
  }
}

export async function GET() {
  try {
    // Verificar cache
    const now = Date.now()
    if (socialCache.data && now - socialCache.timestamp < CACHE_TTL) {
      return NextResponse.json(socialCache.data)
    }

    // Medianoche hora local (TZ=America/Santiago en PM2)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get servers online from ZMQ config (our active servers)
    const getServersOnline = async (): Promise<number> => {
      try {
        const count = await prisma.zmqServerConfig.count({
          where: { enabled: true },
        })
        return count
      } catch {
        return 0
      }
    }

    // Ejecutar queries en paralelo
    const [
      serversOnline,
      matchesToday,
      activePlayers,
      discordMembers,
      youtubeFollowers,
      twitchFollowers,
    ] = await Promise.all([
      // Servidores online (configurados y activos)
      getServersOnline(),
      // Partidas de hoy (hora Chile)
      prisma.match.count({
        where: {
          timestamp: { gte: today },
          gameStatus: "SUCCESS",
        },
      }),
      // Jugadores activos: jugadores únicos que jugaron hoy (hora Chile)
      prisma.playerMatchStats.findMany({
        where: {
          createdAt: { gte: today },
        },
        select: { steamId: true },
        distinct: ['steamId'],
      }).then(results => results.length),
      // APIs externas
      getDiscordMembers(),
      getYoutubeFollowers(),
      getTwitchFollowers(),
    ])

    const stats: SocialStats = {
      serversOnline,
      discordMembers,
      youtubeFollowers,
      twitchFollowers,
      matchesToday,
      activePlayers,
    }

    // Actualizar cache
    socialCache = { data: stats, timestamp: now }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching social stats:", error)
    return NextResponse.json(
      {
        serversOnline: 0,
        discordMembers: 0,
        youtubeFollowers: 0,
        twitchFollowers: 0,
        matchesToday: 0,
        activePlayers: 0,
      },
      { status: 500 }
    )
  }
}
