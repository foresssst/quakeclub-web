import { type NextRequest, NextResponse } from "next/server"
import { getPlayerStats, calculateKD, calculateWinRate, getRankName } from "@/lib/rating-system"
import { cache } from "@/lib/cache"
import { prisma } from "@/lib/prisma"
import { validateSteamId } from "@/lib/security"


export async function GET(request: NextRequest, { params }: { params: Promise<{ steamId: string }> }) {
  try {
    const { steamId } = await params

    // Get game mode from query params (default to 'overall')
    const searchParams = request.nextUrl.searchParams
    const gameMode = searchParams.get("mode") || "overall"

    if (!steamId) {
      return NextResponse.json({ error: "Steam ID is required" }, { status: 400 })
    }

    if (!validateSteamId(steamId)) {
      return NextResponse.json({ error: "Invalid Steam ID format" }, { status: 400 })
    }

    // Check cache first (5 minutes TTL)
    const cacheKey = `qlstats:${steamId}:${gameMode}`
    const cachedData = cache.get(cacheKey)

    if (cachedData) {
      console.log(`Cache HIT for ${cacheKey}`)
      return NextResponse.json(cachedData)
    }

    console.log(`Cache MISS for ${cacheKey}, fetching from QLStats API...`)

    // Fetch player stats
    const playerStats = await getPlayerStats(steamId)

    if (!playerStats) {
      return NextResponse.json({ error: "Player not found on QLStats" }, { status: 404 })
    }

    // Extract stats from the nested structure based on selected game mode
    const overallStatsData = playerStats.overall_stats as any
    const gamesPlayedData = playerStats.games_played as any
    const elosData = playerStats.elos as any
    const ranksData = playerStats.ranks as any

    const overallStats = overallStatsData?.[gameMode] || {}
    const gamesPlayed = gamesPlayedData?.[gameMode] || {}
    const elos = elosData?.[gameMode] || {}
    const ranks = ranksData?.[gameMode] || {}

    // Calculate derived stats
    const kills = overallStats.total_kills || 0
    const deaths = overallStats.total_deaths || 0
    const games = overallStats.games || 0
    const wins = gamesPlayed.wins || 0
    const losses = gamesPlayed.losses || 0
    const elo = elos.g2_r || elos.elo || 0 // Use Glicko-2 rating (g2_r) instead of normalized elo
    const rank = ranks.rank || 0

    const kd = calculateKD(kills, deaths)
    const winRate = calculateWinRate(wins, games)
    const rankName = getRankName(elo)

    // Get favorite map from fav_maps based on selected game mode
    let favoriteMap = "campgrounds"
    const favMapsData = playerStats.fav_maps as any
    if (favMapsData?.[gameMode]) {
      favoriteMap = favMapsData[gameMode].map_name || "campgrounds"
    }

    // Obtener cambios de ELO de nuestra base de datos
    const eloChangesMap: Map<string, number> = new Map()

    try {
      const player = await prisma.player.findUnique({
        where: { steamId },
      })

      if (player) {
        const eloHistory = await prisma.eloHistory.findMany({
          where: {
            playerId: player.id,
            ...(gameMode !== "overall" ? { gameType: gameMode } : {}),
          },
          orderBy: { recordedAt: "desc" },
          take: 50, // Últimos 50 registros
        })

        // Crear un mapa de timestamp -> cambio de ELO
        eloHistory.forEach((record: any) => {
          const timestamp = record.recordedAt.getTime()
          eloChangesMap.set(timestamp.toString(), record.change)
        })
      }
    } catch (dbError) {
      console.error("Error fetching ELO history from DB:", dbError)
      // Continuar sin los cambios de ELO si hay error
    }

    // Map recent games to the format expected by the UI
    // Filter by game mode if not 'overall'
    console.log("[Noticias] Recent games from API:", JSON.stringify(playerStats.recent_games?.slice(0, 2), null, 2))
    console.log("[Noticias] Total recent games:", playerStats.recent_games?.length)
    console.log("[Noticias] Selected game mode:", gameMode)

    let recentGamesFiltered = playerStats.recent_games || []
    if (gameMode !== "overall") {
      recentGamesFiltered = recentGamesFiltered.filter((game) => game.game_type_cd === gameMode)
      console.log("[Noticias] Filtered games for", gameMode, ":", recentGamesFiltered.length)
    }

    const ctfGames = (playerStats.recent_games || []).filter((g) => g.game_type_cd === "ctf")
    console.log("[Noticias] CTF games found:", ctfGames.length)
    if (ctfGames.length > 0) {
      console.log("[Noticias] Sample CTF game:", JSON.stringify(ctfGames[0], null, 2))
    }

    const mappedRecentGames = recentGamesFiltered.slice(0, 10).map((game) => {
      const userPlayerId = playerStats.player.player_id
      let result: "win" | "loss" = "loss"

      // Para DUEL: comparar scores directamente según quién sea pg1 o pg2
      // Para otros modos: usar teams
      const isDuel = game.game_type_cd === "duel"

      if (isDuel) {
        // En duel, pg1_player_id vs pg2_player_id
        // score1 es el score de pg1, score2 es el score de pg2
        if (game.pg1_player_id === userPlayerId) {
          // Usuario es pg1, ganó si score1 > score2
          result = game.score1 > game.score2 ? "win" : "loss"
        } else if (game.pg2_player_id === userPlayerId) {
          // Usuario es pg2, ganó si score2 > score1
          result = game.score2 > game.score1 ? "win" : "loss"
        }
      } else {
        // Para modos de equipo (CA, TDM, CTF, etc.)
        let userTeam: number | undefined = 0
        if (game.pg1_player_id === userPlayerId) {
          userTeam = game.pg1_team
        } else if (game.pg2_player_id === userPlayerId) {
          userTeam = game.pg2_team
        } else if (game.pg3_player_id === userPlayerId) {
          userTeam = game.pg3_team
        }

        // Team 1 ganó si score1 > score2
        // Team 2 ganó si score2 > score1
        if (game.score1 > game.score2 && userTeam === 1) {
          result = "win"
        } else if (game.score2 > game.score1 && userTeam === 2) {
          result = "win"
        }
      }

      // Buscar cambio de ELO para este match en el Map
      const gameTimestamp = game.start_dt ? new Date(game.start_dt).getTime() : Date.now()
      let eloChange = 0

      // Buscar en un rango de ±1 minuto del timestamp del match
      const timeWindow = 60000 // 1 minuto en ms
      for (const [timestampStr, change] of eloChangesMap.entries()) {
        const recordTime = Number.parseInt(timestampStr)
        if (Math.abs(recordTime - gameTimestamp) < timeWindow) {
          eloChange = change
          break
        }
      }

      return {
        map: game.map_name || "campgrounds",
        gameType: game.game_type_cd?.toUpperCase() || "CA",
        result,
        timestamp: gameTimestamp,
        server: game.server_name || "Unknown Server",
        score: `${game.score1}-${game.score2}`,
        eloChange: eloChange,
      }
    })

    console.log("Mapped recent games:", JSON.stringify(mappedRecentGames.slice(0, 2), null, 2))

    const responseData = {
      success: true,
      gameMode,
      stats: {
        games,
        wins,
        losses,
        kills,
        deaths,
        kd,
        winRate,
        elo,
        rank,
        rankName,
        favoriteMap,
        playTime: overallStats.total_playing_time || 0,
        username: playerStats.player?.stripped_nick || playerStats.player?.nick || "Unknown",
        joinedDate: playerStats.player?.joined || null,
      },
      recentGames: mappedRecentGames,
    }

    // Cache the response for 5 minutes
    cache.set(cacheKey, responseData, 5 * 60 * 1000)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching QLStats data:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
