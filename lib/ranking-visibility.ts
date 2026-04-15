export const MIN_GAMES_LADDER = 3

export interface PlacementInfo {
  isPlacement: boolean
  totalGames: number
  minGames: number
  gamesRemaining: number
}

export function normalizeGameType(gameType: string | null | undefined): string {
  return (gameType || "ca").toLowerCase()
}

export function getMinGamesForRanking(gameType: string, ratingType: string = "public"): number {
  if (ratingType === "ladder") {
    return MIN_GAMES_LADDER
  }

  return normalizeGameType(gameType) === "ca" ? 35 : 5
}

export function getPlacementInfo(
  totalGames: number | null | undefined,
  gameType: string,
  ratingType: string = "public",
): PlacementInfo {
  const playedGames = Math.max(0, totalGames || 0)
  const minGames = getMinGamesForRanking(gameType, ratingType)
  const gamesRemaining = Math.max(0, minGames - playedGames)

  return {
    isPlacement: gamesRemaining > 0,
    totalGames: playedGames,
    minGames,
    gamesRemaining,
  }
}

export function getPlacementKey(
  steamId: string,
  gameType: string | null | undefined,
  ratingType: string = "public",
): string {
  return `${steamId}:${normalizeGameType(gameType)}:${ratingType}`
}

export function buildPlacementMap(
  rows: Array<{
    steamId: string
    gameType: string
    totalGames: number | null | undefined
  }>,
  ratingType: string = "public",
): Map<string, PlacementInfo> {
  const placementMap = new Map<string, PlacementInfo>()

  for (const row of rows) {
    placementMap.set(
      getPlacementKey(row.steamId, row.gameType, ratingType),
      getPlacementInfo(row.totalGames, row.gameType, ratingType),
    )
  }

  return placementMap
}

export function getPlacementFromMap(
  placementMap: Map<string, PlacementInfo>,
  steamId: string,
  gameType: string,
  ratingType: string = "public",
): PlacementInfo {
  return placementMap.get(getPlacementKey(steamId, gameType, ratingType)) || getPlacementInfo(0, gameType, ratingType)
}
