/**
 * Steam API utilities
 * Centralized Steam API functions used across the application.
 */

export async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        throw error
    }
}

export interface SteamPlayerData {
    username: string
    avatar: string | null
    countryCode: string
}

export async function getSteamPlayersBatch(steamIds: string[]): Promise<Map<string, SteamPlayerData>> {
    const result = new Map<string, SteamPlayerData>()
    if (steamIds.length === 0) return result

    try {
        const apiKey = process.env.STEAM_API_KEY
        if (!apiKey) return result

        const batchSize = 100
        for (let i = 0; i < steamIds.length; i += batchSize) {
            const batch = steamIds.slice(i, i + batchSize)
            const steamIdsParam = batch.join(',')

            try {
                const response = await fetchWithTimeout(
                    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamIdsParam}`,
                    8000
                )

                if (!response.ok) continue

                const data = await response.json()
                const players = data.response?.players || []

                for (const player of players) {
                    result.set(player.steamid, {
                        username: player.personaname || '',
                        avatar: player.avatarfull || player.avatarmedium || null,
                        countryCode: player.loccountrycode || 'CL'
                    })
                }
            } catch {
                // Continue with next batch on error
            }
        }
    } catch (error) {
        console.error('[Steam] Error fetching players batch:', error)
    }

    return result
}
