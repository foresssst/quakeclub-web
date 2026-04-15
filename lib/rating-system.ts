// Integración de API QLStats
// Documentación: https://qlstats.net
// QLStats funciona con cualquier servidor de Quake Live usando el plugin minqlx

const QLSTATS_BASE_URL = "https://qlstats.net"

// Estructura real de respuesta de API QLStats
export interface QLStatsPlayer {
  player: {
    stripped_nick: string
    nick: string
    joined: string
    player_id: number
    active_ind: boolean
    location: string | null
  }
  elos: {
    overall: { elo: number; games: number; g2_r: number; g2_rd: number }
    duel: { elo: number; games: number; g2_r: number; g2_rd: number }
    ca: { elo: number; games: number; g2_r: number; g2_rd: number }
    ctf: { elo: number; games: number; g2_r: number; g2_rd: number }
    ffa: { elo: number; games: number; g2_r: number; g2_rd: number }
    tdm: { elo: number; games: number; g2_r: number; g2_rd: number }
    ft: { elo: number; games: number; g2_r: number; g2_rd: number }
    ad: { elo: number; games: number; g2_r: number; g2_rd: number }
    rr?: { elo: number; games: number; g2_r: number; g2_rd: number }
  }
  ranks: {
    overall: { rank: number; max_rank: number }
    duel: { rank: number; max_rank: number }
    ca: { rank: number; max_rank: number }
    ctf: { rank: number; max_rank: number }
    ffa: { rank: number; max_rank: number }
  }
  overall_stats: {
    overall: { total_playing_time: number; total_kills: number; total_deaths: number; games: number }
    duel: { total_playing_time: number; total_kills: number; total_deaths: number; games: number }
    ca: { total_playing_time: number; total_kills: number; total_deaths: number; games: number }
    ctf: { total_playing_time: number; total_kills: number; total_deaths: number; games: number }
    ffa: { total_playing_time: number; total_kills: number; total_deaths: number; games: number }
  }
  games_played: {
    overall: { wins: number; losses: number }
    duel: { wins: number; losses: number }
    ca: { wins: number; losses: number }
    ctf: { wins: number; losses: number }
    ffa: { wins: number; losses: number }
  }
  fav_maps: {
    overall: { map_name: string; times_played: number; map_id: number; game_type_cd: string }
    duel: { map_name: string; times_played: number; map_id: number; game_type_cd: string }
    ca: { map_name: string; times_played: number; map_id: number; game_type_cd: string }
    ctf: { map_name: string; times_played: number; map_id: number; game_type_cd: string }
    ffa: { map_name: string; times_played: number; map_id: number; game_type_cd: string }
    tdm: { map_name: string; times_played: number; map_id: number; game_type_cd: string }
  }
  recent_games: Array<{
    game_id: number
    game_type_cd: string
    game_type_descr: string
    map_name: string
    start_dt: string
    server_name: string
    score1: number
    score2: number
    winner: 1 | 2
    pg1_player_id: number
    pg1_nick: string
    pg1_team: number
    pg2_player_id: number
    pg2_nick: string
    pg2_team: number
    pg3_player_id?: number
    pg3_nick?: string
    pg3_team?: number
    epoch: number
  }>
}

export interface QLStatsWeaponStats {
  gt: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Gauntlet
  mg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Machine Gun
  sg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Shotgun
  gl: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Grenade Launcher
  rl: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Rocket Launcher
  lg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Lightning Gun
  rg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Railgun
  pg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Plasma Gun
  bfg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // BFG
  hmg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Heavy Machine Gun
  cg: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Chaingun
  ng: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Nailgun
  pm: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Proximity Mine
  gh: { hits: number; shots: number; kills: number; damage: number; pickups: number } // Grappling Hook
}

export interface QLStatsRecentGame {
  gameId: string
  gameType: string
  map: string
  server: string
  timestamp: number
  result: "win" | "loss" | "tie"
  score: string
  rank: number
  kills: number
  deaths: number
  damage: number
  eloChange: number
}

export interface QLStatsGameTypeStats {
  gameType: string
  games: number
  wins: number
  losses: number
  elo: number
  rank: number
  kills: number
  deaths: number
  damageDealt: number
}

// Obtiene datos del jugador desde QLStats
// Punto final: GET /player/:steamid
export async function getPlayerStats(steamId: string): Promise<QLStatsPlayer | null> {
  try {
    // QLStats usa el punto final /player/:steamid (no se necesita extensión .json)
    const response = await fetch(`${QLSTATS_BASE_URL}/player/${steamId}`, {
      headers: {
        "User-Agent": "QuakeClub/1.0",
        "Accept": "application/json",
      },
      next: { revalidate: 300 }, // Cache durante 5 minutos
    })

    if (!response.ok) {
      console.error(`QLStats API error: ${response.status} ${response.statusText}`)
      return null
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      // Intenta con extensión .json como respuesta alternativa
      return getPlayerStatsWithJsonExt(steamId)
    }

    const data = await response.json()

    // API devuelve array con un solo objeto, lo extrae
    const playerData = Array.isArray(data) ? data[0] : data
    return playerData as QLStatsPlayer
  } catch (error) {
    console.error("Error fetching QLStats player data:", error)
    // Intenta con extensión .json
    return getPlayerStatsWithJsonExt(steamId)
  }
}

// Alternativa: Intenta con extensión .json
async function getPlayerStatsWithJsonExt(steamId: string): Promise<QLStatsPlayer | null> {
  try {
    const response = await fetch(`${QLSTATS_BASE_URL}/player/${steamId}.json`, {
      headers: {
        "User-Agent": "QuakeClub/1.0",
        "Accept": "application/json",
      },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      console.error(`QLStats .json API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    // API devuelve array con un solo objeto, lo extrae
    const playerData = Array.isArray(data) ? data[0] : data
    return playerData as QLStatsPlayer
  } catch (error) {
    console.error("Error fetching QLStats .json player data:", error)
    return null
  }
}

// Obtiene partidos recientes de un jugador
export async function getRecentGames(steamId: string, limit: number = 20): Promise<QLStatsRecentGame[]> {
  try {
    const response = await fetch(`${QLSTATS_BASE_URL}/player/${steamId}/games.json?limit=${limit}`, {
      headers: {
        "User-Agent": "QuakeClub/1.0",
      },
      next: { revalidate: 60 }, // Cache durante 1 minuto
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.games || []
  } catch (error) {
    console.error("Error fetching recent games:", error)
    return []
  }
}

// Obtiene estadísticas de armas de un jugador
export async function getWeaponStats(steamId: string): Promise<QLStatsWeaponStats | null> {
  try {
    const response = await fetch(`${QLSTATS_BASE_URL}/player/${steamId}/weapons.json`, {
      headers: {
        "User-Agent": "QuakeClub/1.0",
      },
      next: { revalidate: 300 }, // Cache durante 5 minutos
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data as QLStatsWeaponStats
  } catch (error) {
    console.error("Error fetching weapon stats:", error)
    return null
  }
}

// Obtiene estadísticas para tipo de partido específico (duel, ca, ctf, ffa, etc.)
export async function getGameTypeStats(steamId: string, gameType: string): Promise<QLStatsGameTypeStats | null> {
  try {
    const response = await fetch(`${QLSTATS_BASE_URL}/player/${steamId}/${gameType}.json`, {
      headers: {
        "User-Agent": "QuakeClub/1.0",
      },
      next: { revalidate: 300 }, // Cache durante 5 minutos
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data as QLStatsGameTypeStats
  } catch (error) {
    console.error("Error fetching game type stats:", error)
    return null
  }
}

// Calcula porcentaje de precisión
export function calculateAccuracy(hits: number, shots: number): number {
  if (shots === 0) return 0
  return Math.round((hits / shots) * 100)
}

// Calcula ratio K/D
export function calculateKD(kills: number, deaths: number): number {
  return Math.round((kills / Math.max(deaths, 1)) * 100) / 100
}

// Calcula porcentaje de tasa de victorias
export function calculateWinRate(wins: number, games: number): number {
  if (games === 0) return 0
  return Math.round((wins / games) * 100)
}

// Obtiene nombre de rango basado en ELO
export function getRankName(elo: number): string {
  if (elo >= 2000) return "Master"
  if (elo >= 1800) return "Diamante"
  if (elo >= 1600) return "Platino"
  if (elo >= 1400) return "Oro"
  if (elo >= 1200) return "Plata"
  if (elo >= 1000) return "Bronce"
  return "Sin Clasificar"
}

// Obtiene mapa favorito (más jugado)
export function getFavoriteMap(games: QLStatsRecentGame[]): string {
  if (games.length === 0) return "N/A"

  const mapCounts: Record<string, number> = {}
  games.forEach((game) => {
    mapCounts[game.map] = (mapCounts[game.map] || 0) + 1
  })

  return Object.entries(mapCounts).sort((a, b) => b[1] - a[1])[0][0]
}

// Formatea tiempo de juego de segundos a horas
export function formatPlayTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  return `${hours}h`
}
