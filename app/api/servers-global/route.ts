import { NextResponse } from "next/server"

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

// Listado de servidores propios desde env (JSON: {"<ip>": {country, countryCode, region}})
const OUR_SERVERS: Record<string, { country: string; countryCode: string; region: string }> =
  (() => {
    const raw = process.env.OUR_SERVERS_JSON
    if (!raw) return {}
    try { return JSON.parse(raw) } catch { return {} }
  })()

// Helper to check if IP is ours
const isOurServer = (ip: string) => ip in OUR_SERVERS

// Cache
let cachedServers: { our: any[]; world: any[] } = { our: [], world: [] }
let cacheTimestamp = 0
const CACHE_DURATION = 60000 // 1 minute for global servers

// IP Geolocation cache (IPs don't change location, so cache longer)
const geoCache: Map<string, { country: string; countryCode: string; continent: string }> = new Map()
const GEO_CACHE_DURATION = 86400000 // 24 hours
let geoCacheTimestamp = 0

// Fetch geolocation for multiple IPs using ip-api.com batch API
async function fetchGeolocations(ips: string[]): Promise<void> {
  // Only fetch IPs not in cache
  const ipsToFetch = ips.filter(ip => !geoCache.has(ip))
  if (ipsToFetch.length === 0) return

  // Check if geo cache is too old
  if (Date.now() - geoCacheTimestamp > GEO_CACHE_DURATION) {
    geoCache.clear()
    geoCacheTimestamp = Date.now()
  }

  try {
    // ip-api.com batch endpoint (max 100 IPs per request)
    const batches: string[][] = []
    for (let i = 0; i < ipsToFetch.length; i += 100) {
      batches.push(ipsToFetch.slice(i, i + 100))
    }

    for (const batch of batches) {
      const response = await fetch("http://ip-api.com/batch?fields=status,country,countryCode,continent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch.map(ip => ({ query: ip }))),
      })

      if (response.ok) {
        const results = await response.json()
        for (let i = 0; i < results.length; i++) {
          const result = results[i]
          const ip = batch[i]
          if (result.status === "success") {
            geoCache.set(ip, {
              country: result.country,
              countryCode: result.countryCode,
              continent: result.continent,
            })
          }
        }
      }
    }
  } catch (error) {
    console.error("[Geolocation] Error fetching:", error)
  }
}

// Map continent name to our region format
function continentToRegion(continent: string): string {
  switch (continent) {
    case "Africa": return "Africa"
    case "Asia": return "Asia"
    case "Europe": return "Europe"
    case "North America": return "North America"
    case "Oceania": return "Oceania"
    case "South America": return "South America"
    default: return "Europe"
  }
}

// Extract clean game type
function extractGameType(gametype: string): string {
  const types = gametype.toLowerCase().split(",")
  const priorityTypes = ["clanarena", "ca", "duel", "ctf", "tdm", "ffa", "race", "ft", "redrover", "infected", "instagib", "freezetag"]

  for (const pType of priorityTypes) {
    if (types.some(t => t.trim() === pType)) {
      switch (pType) {
        case "clanarena": return "CA"
        case "ca": return "CA"
        case "duel": return "DUEL"
        case "ctf": return "CTF"
        case "tdm": return "TDM"
        case "ffa": return "FFA"
        case "race": return "RACE"
        case "ft": return "FT"
        case "freezetag": return "FT"
        case "redrover": return "RT"
        case "infected": return "RT"
        case "instagib": return "INSTAGIB"
        default: return pType.toUpperCase()
      }
    }
  }

  return types[0]?.trim().toUpperCase() || "UNKNOWN"
}

// Get continent from Steam region code and server name hints
// Returns: Africa, Asia, Europe, North America, Oceania, South America
function getRegionName(regionCode: number, serverName: string, serverIp: string): string {
  const nameLower = serverName.toLowerCase()

  // Check server name for location hints and map to continents

  // South America hints
  if (nameLower.includes("latam") || nameLower.includes("chile") || nameLower.includes("argentina") ||
    nameLower.includes("peru") || nameLower.includes("colombia") || nameLower.includes("venezuela") ||
    nameLower.includes("ecuador") || nameLower.includes("uruguay") || nameLower.includes("paraguay") ||
    nameLower.includes("bolivia") || nameLower.includes("brazil") || nameLower.includes("brasil") ||
    nameLower.includes("[br]") || nameLower.includes("br ") || nameLower.includes(" sa ") ||
    nameLower.includes("[sa]") || nameLower.includes("south america")) {
    return "South America"
  }

  // North America hints
  if (nameLower.includes("usa") || nameLower.includes("us ") || nameLower.includes("[us]") ||
    nameLower.includes("na ") || nameLower.includes("[na]") || nameLower.includes("north america") ||
    nameLower.includes("canada") || nameLower.includes("mexico") || nameLower.includes("dallas") ||
    nameLower.includes("chicago") || nameLower.includes("new york") || nameLower.includes("los angeles") ||
    nameLower.includes("seattle") || nameLower.includes("denver") || nameLower.includes("atlanta") ||
    nameLower.includes("virginia") || nameLower.includes("texas") || nameLower.includes("california")) {
    return "North America"
  }

  // Europe hints
  if (nameLower.includes("eu ") || nameLower.includes("[eu]") || nameLower.includes("europe") ||
    nameLower.includes("germany") || nameLower.includes("german") || nameLower.includes("[de]") ||
    nameLower.includes("france") || nameLower.includes("french") || nameLower.includes("[fr]") ||
    nameLower.includes("uk ") || nameLower.includes("[uk]") || nameLower.includes("london") ||
    nameLower.includes("poland") || nameLower.includes("[pl]") || nameLower.includes("sweden") ||
    nameLower.includes("netherlands") || nameLower.includes("[nl]") || nameLower.includes("spain") ||
    nameLower.includes("italy") || nameLower.includes("russia") || nameLower.includes("moscow") ||
    nameLower.includes("frankfurt") || nameLower.includes("amsterdam") || nameLower.includes("paris") ||
    nameLower.includes("warsaw") || nameLower.includes("stockholm") || nameLower.includes("helsinki") ||
    nameLower.includes("norway") || nameLower.includes("denmark") || nameLower.includes("finland") ||
    nameLower.includes("austria") || nameLower.includes("switzerland") || nameLower.includes("belgium") ||
    nameLower.includes("portugal") || nameLower.includes("czech") || nameLower.includes("hungary") ||
    nameLower.includes("romania") || nameLower.includes("ukraine") || nameLower.includes("greece")) {
    return "Europe"
  }

  // Asia hints
  if (nameLower.includes("asia") || nameLower.includes("japan") || nameLower.includes("[jp]") ||
    nameLower.includes("china") || nameLower.includes("[cn]") || nameLower.includes("korea") ||
    nameLower.includes("[kr]") || nameLower.includes("singapore") || nameLower.includes("[sg]") ||
    nameLower.includes("hong kong") || nameLower.includes("taiwan") || nameLower.includes("india") ||
    nameLower.includes("tokyo") || nameLower.includes("shanghai") || nameLower.includes("seoul") ||
    nameLower.includes("bangkok") || nameLower.includes("vietnam") || nameLower.includes("indonesia") ||
    nameLower.includes("malaysia") || nameLower.includes("philippines") || nameLower.includes("thailand")) {
    return "Asia"
  }

  // Oceania hints
  if (nameLower.includes("australia") || nameLower.includes("aussie") || nameLower.includes("[au]") ||
    nameLower.includes("oceania") || nameLower.includes("new zealand") || nameLower.includes("[nz]") ||
    nameLower.includes("sydney") || nameLower.includes("melbourne") || nameLower.includes("auckland")) {
    return "Oceania"
  }

  // Africa hints
  if (nameLower.includes("africa") || nameLower.includes("south africa") || nameLower.includes("[za]") ||
    nameLower.includes("johannesburg") || nameLower.includes("cape town") || nameLower.includes("egypt") ||
    nameLower.includes("morocco") || nameLower.includes("nigeria") || nameLower.includes("kenya")) {
    return "Africa"
  }

  // Steam region codes (fallback to continents)
  switch (regionCode) {
    case 0: return "North America" // US East Coast
    case 1: return "North America" // US West Coast
    case 2: return "South America"
    case 3: return "Europe"
    case 4: return "Asia"
    case 5: return "Oceania" // Australia
    case 6: return "Asia" // Middle East -> Asia
    case 7: return "Africa"
    default: return "Europe" // Default to Europe instead of "world"
  }
}

export async function GET() {
  try {
    const now = Date.now()

    // Check cache
    if (cachedServers.our.length > 0 && now - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json(cachedServers, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      })
    }

    const steamApiKey = process.env.STEAM_API_KEY
    if (!steamApiKey) {
      return NextResponse.json({ our: [], world: [] }, { status: 500 })
    }

    // Fetch ALL Quake Live servers
    const filter = `\\appid\\${QUAKE_LIVE_APPID}`
    const url = `https://api.steampowered.com/IGameServersService/GetServerList/v1/?key=${steamApiKey}&filter=${encodeURIComponent(filter)}&limit=500`

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    })

    if (!response.ok) {
      console.error(`[Steam API] Error: ${response.status}`)
      return NextResponse.json(cachedServers, { status: 200 })
    }

    const data: SteamApiResponse = await response.json()
    const allServers = data.response?.servers || []

    // Collect all unique IPs for geolocation
    const uniqueIps = new Set<string>()
    for (const server of allServers) {
      const [ip] = server.addr.split(":")
      if (!isOurServer(ip)) {
        uniqueIps.add(ip)
      }
    }

    // Fetch geolocations for all IPs
    await fetchGeolocations(Array.from(uniqueIps))

    // Transform and separate our servers from world servers
    const ourServers: any[] = []
    const worldServers: any[] = []

    for (const server of allServers) {
      const [ip, portStr] = server.addr.split(":")
      const port = parseInt(portStr) || server.gameport
      const isOurs = isOurServer(ip)
      const ourServerInfo = OUR_SERVERS[ip]

      // Get geolocation data
      const geo = geoCache.get(ip)

      const transformed = {
        ip,
        port,
        name: server.name || `Server ${server.addr}`,
        map: server.map || "",
        gameType: extractGameType(server.gametype || ""),
        players: server.players || 0,
        maxplayers: server.max_players || 16,
        status: "online",
        // Use our server mapping for our servers, geolocation for world servers
        country: isOurs ? ourServerInfo.country : geo?.country,
        countryCode: isOurs ? ourServerInfo.countryCode : geo?.countryCode,
        region: isOurs
          ? ourServerInfo.region
          : geo?.continent
            ? continentToRegion(geo.continent)
            : getRegionName(server.region, server.name, ip),
        isOurs,
      }

      if (isOurs) {
        ourServers.push(transformed)
      } else {
        worldServers.push(transformed)
      }
    }

    // Sort by players descending
    ourServers.sort((a, b) => b.players - a.players)
    worldServers.sort((a, b) => b.players - a.players)

    // Update cache
    cachedServers = { our: ourServers, world: worldServers }
    cacheTimestamp = now

    return NextResponse.json(cachedServers, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  } catch (error) {
    console.error("[API] Error fetching global servers:", error)
    return NextResponse.json(cachedServers.our.length > 0 ? cachedServers : { our: [], world: [] }, {
      status: 200,
    })
  }
}
