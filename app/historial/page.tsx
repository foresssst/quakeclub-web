"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { parseQuakeColors } from "@/lib/quake-colors"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { LoadingScreen } from "@/components/loading-screen"

interface MatchPlayer {
  name: string
  steamId: string
  score: number
}

interface Match {
  id: string
  matchId: string
  gameType: string
  map: string
  timestamp: string
  player1?: MatchPlayer
  player2?: MatchPlayer
  team1?: MatchPlayer[]
  team2?: MatchPlayer[]
  score: string
}

interface HistoryResponse {
  matches: Match[]
  pagination: {
    page: number
    limit: number
    totalMatches: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: {
    maps: string[]
  }
}

const GAME_TYPES = [
  { id: "all", label: "TODOS" },
  { id: "ca", label: "CA" },
  { id: "duel", label: "DUEL" },
  { id: "tdm", label: "TDM" },
  { id: "ctf", label: "CTF" },
  { id: "ffa", label: "FFA" },
]

const MAP_NAMES: Record<string, string> = {
  campgrounds: "Campgrounds",
  bloodrun: "Blood Run",
  aerowalk: "Aerowalk",
  toxicity: "Toxicity",
  asylum: "Asylum",
  cure: "Cure",
  coldwar: "Cold War",
  silence: "Silence",
  hiddenfortress: "Hidden Fortress",
  trinity: "Trinity",
  thunderstruck: "Thunderstruck",
  overkill: "Overkill",
  quarantine: "Quarantine",
  revolver: "Revolver",
  deadandgone: "Dead And Gone",
  eyetoeye: "Eye To Eye",
  shiningforces: "Shining Forces",
  useandabuse: "Use And Abuse",
  ironworks: "Iron Works",
  battleforged: "Battle Forged",
  sinister: "Sinister",
  intervention: "Intervention",
  catalyst: "Catalyst",
  courtyard: "Courtyard",
  dreadfulplace: "Dreadful Place",
  furiousheights: "Furious Heights",
  hektik: "Hektik",
  lostworld: "Lost World",
  vertical: "Vertical",
  terminatria: "Terminatria",
  spidercrossings: "Spider Crossings",
  arenagate: "Arena Gate",
  blastradius: "Blast Radius",
  almostlost: "Almost Lost",
  basesiege: "Base Siege",
  beyondreality: "Beyond Reality",
  brimstoneabbey: "Brimstone Abbey",
  citycrossings: "City Crossings",
  cliffside: "Cliffside",
  deepinside: "Deep Inside",
  demonkeep: "Demon Keep",
  distantscreams: "Distant Screams",
  dredwerkz: "Dredwerkz",
  eviscerated: "Eviscerated",
  fallout: "Fallout",
  foolishlegacy: "Foolish Legacy",
  gothicrage: "Gothic Rage",
  grimdungeons: "Grim Dungeons",
  hellsgate: "Hells Gate",
  houseofdecay: "House Of Decay",
  industrialrevolution: "Industrial Revolution",
  innersanctums: "Inner Sanctums",
  japanesecastles: "Japanese Castles",
  longestyard: "Longest Yard",
  powerstation: "Power Station",
  q3dm6: "The Camping Grounds",
  q3dm17: "The Longest Yard",
  q3tourney2: "The Proving Grounds",
  q3tourney4: "Vertical Vengeance",
  smash: "Smash",
}

function formatMapName(mapName: string) {
  const lower = mapName.toLowerCase()
  if (MAP_NAMES[lower]) return MAP_NAMES[lower]
  return mapName.charAt(0).toUpperCase() + mapName.slice(1)
}

function getLocaleCode(locale: string) {
  return locale === "es" ? "es-CL" : "en-US"
}

function formatDayLabel(timestamp: string, locale: string) {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp))
}

function formatTimeLabel(timestamp: string, locale: string) {
  return new Intl.DateTimeFormat(getLocaleCode(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function groupMatchesByDay(matches: Match[], locale: string) {
  const groups = new Map<string, { label: string; matches: Match[] }>()

  for (const match of matches) {
    const date = new Date(match.timestamp)
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

    if (!groups.has(key)) {
      groups.set(key, {
        label: formatDayLabel(match.timestamp, locale),
        matches: [],
      })
    }

    groups.get(key)?.matches.push(match)
  }

  return Array.from(groups.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    matches: value.matches,
  }))
}

function getModeTone(gameType: string) {
  switch (gameType.toLowerCase()) {
    case "duel":
      return "bg-foreground text-white border-black/10"
    case "ca":
      return "bg-foreground/9 text-foreground border-black/10"
    case "ctf":
      return "bg-[#2563eb]/12 text-[#1d4ed8] border-[#2563eb]/16"
    case "tdm":
      return "bg-[#b45309]/12 text-[#92400e] border-[#b45309]/18"
    case "ffa":
      return "bg-[#7c3aed]/12 text-[#6d28d9] border-[#7c3aed]/16"
    default:
      return "bg-foreground/[0.05] text-foreground/60 border-foreground/[0.08]"
  }
}

function HistoryScore({ match }: { match: Match }) {
  if (match.player1 && match.player2) {
    const score1 = match.player1.score
    const score2 = match.player2.score
    const p1Won = score1 > score2
    const p2Won = score2 > score1

    return (
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <span className={`min-w-0 max-w-[120px] sm:max-w-[220px] truncate text-right text-sm sm:text-base ${p1Won ? "text-foreground font-semibold" : "text-black/45"}`}>
          {parseQuakeColors(match.player1.name)}
        </span>
        <div className="shrink-0 rounded-full border border-foreground/[0.08] bg-black/[0.035] px-3 py-1.5 sm:px-4 sm:py-2 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
          <span className={`text-base sm:text-lg font-bold tabular-nums ${p1Won ? "text-foreground" : "text-black/35"}`}>{score1}</span>
          <span className="px-1.5 sm:px-2 text-foreground/20 font-bold">:</span>
          <span className={`text-base sm:text-lg font-bold tabular-nums ${p2Won ? "text-foreground" : "text-black/35"}`}>{score2}</span>
        </div>
        <span className={`min-w-0 max-w-[120px] sm:max-w-[220px] truncate text-left text-sm sm:text-base ${p2Won ? "text-foreground font-semibold" : "text-black/45"}`}>
          {parseQuakeColors(match.player2.name)}
        </span>
      </div>
    )
  }

  const [score1, score2] = match.score.split("-").map((value) => Number(value))
  const team1 = match.team1 || []
  const team2 = match.team2 || []
  const team1Won = score1 > score2
  const team2Won = score2 > score1

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      <div className="min-w-0 flex-1 text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/28">Red</p>
        <div className="mt-1 flex items-center justify-end gap-1.5">
          {team1.length > 1 && <span className="text-[10px] uppercase tracking-[0.18em] text-black/24">+{team1.length - 1}</span>}
          <span className={`truncate text-sm sm:text-base ${team1Won ? "text-foreground font-semibold" : "text-black/45"}`}>
            {team1[0] ? parseQuakeColors(team1[0].name) : "Team 1"}
          </span>
        </div>
      </div>

      <div className="shrink-0 rounded-full border border-foreground/[0.08] bg-black/[0.035] px-3 py-1.5 sm:px-4 sm:py-2 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
        <span className={`text-base sm:text-lg font-bold tabular-nums ${team1Won ? "text-foreground" : "text-black/35"}`}>{score1}</span>
        <span className="px-1.5 sm:px-2 text-foreground/20 font-bold">:</span>
        <span className={`text-base sm:text-lg font-bold tabular-nums ${team2Won ? "text-foreground" : "text-black/35"}`}>{score2}</span>
      </div>

      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/28">Blue</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`truncate text-sm sm:text-base ${team2Won ? "text-foreground font-semibold" : "text-black/45"}`}>
            {team2[0] ? parseQuakeColors(team2[0].name) : "Team 2"}
          </span>
          {team2.length > 1 && <span className="text-[10px] uppercase tracking-[0.18em] text-black/24">+{team2.length - 1}</span>}
        </div>
      </div>
    </div>
  )
}

function HistoryMatchCard({ match, locale }: { match: Match; locale: string }) {
  return (
    <Link
      href={`/match/${match.matchId}`}
      className="group block rounded-[22px] border border-black/[0.07] bg-[#d8d8dd] shadow-[0_10px_24px_rgba(0,0,0,0.08)] transition-all hover:-translate-y-[1px] hover:border-black/[0.1] hover:shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex items-start justify-between gap-3 lg:w-[200px] lg:flex-shrink-0 lg:flex-col lg:justify-center">
          <div>
            <p className="text-[11px] font-mono text-black/36">
              {formatTimeLabel(match.timestamp, locale)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${getModeTone(match.gameType)}`}>
                {match.gameType}
              </span>
            </div>
          </div>
          <div className="text-right lg:hidden">
            <p className="text-[10px] uppercase tracking-[0.18em] text-black/24">{formatMapName(match.map)}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <HistoryScore match={match} />
        </div>

        <div className="hidden items-center gap-3 lg:flex lg:w-[220px] lg:flex-shrink-0 lg:justify-end">
          <div className="overflow-hidden rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.04] shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
            <img
              src={`/levelshots/${match.map.toLowerCase()}.jpg`}
              alt={match.map}
              className="h-12 w-20 object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              onError={(event) => {
                ;(event.target as HTMLImageElement).src = "/levelshots/default.jpg"
              }}
            />
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-black/22">{match.gameType}</p>
            <p className="mt-1 truncate text-sm text-black/54">{formatMapName(match.map)}</p>
          </div>
          <svg className="h-4 w-4 text-black/18 transition-colors group-hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  )
}

export default function HistorialPage() {
  const t = useTranslations("historial")
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [page, setPage] = useState(() => {
    const value = searchParams.get("page")
    return value ? parseInt(value) : 1
  })
  const [gameType, setGameType] = useState(() => searchParams.get("mode") || "all")
  const [mapFilter, setMapFilter] = useState(() => searchParams.get("map") || "")
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("from") || "")
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") || "")

  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set("page", page.toString())
    if (gameType !== "all") params.set("mode", gameType)
    if (mapFilter) params.set("map", mapFilter)
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)

    const queryString = params.toString()
    router.replace(`/historial${queryString ? `?${queryString}` : ""}`, { scroll: false })
  }, [page, gameType, mapFilter, dateFrom, dateTo, router])

  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ["match-history", page, gameType, mapFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        gameType,
      })
      if (mapFilter) params.set("map", mapFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const res = await fetch(`/api/matches/history?${params}`)
      if (!res.ok) throw new Error("Error fetching history")
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const matches = data?.matches || []
  const pagination = data?.pagination || {
    page: 1,
    totalPages: 0,
    totalMatches: 0,
    hasNext: false,
    hasPrev: false,
    limit: 20,
  }

  const hasFilters = gameType !== "all" || Boolean(mapFilter) || Boolean(dateFrom) || Boolean(dateTo)
  const groupedMatches = groupMatchesByDay(matches, locale)
  const currentMode = GAME_TYPES.find((type) => type.id === gameType) || GAME_TYPES[0]

  const handleGameTypeChange = (type: string) => {
    setGameType(type)
    setPage(1)
  }

  const handleSearch = () => {
    setPage(1)
  }

  const handleClearFilters = () => {
    setGameType("all")
    setMapFilter("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-6 md:px-8 pb-12 pt-8 sm:pt-12">
        <div className="mx-auto max-w-[1120px] space-y-5 animate-fade-up">
          <ContentContainer className="animate-scale-fade overflow-hidden">
            <ContentHeader className="relative">
              <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-black/28">
                    {pagination.totalMatches.toLocaleString()} {t("matchesFound")}
                  </p>
                  <h1 className="mt-2 font-tiktok text-xl sm:text-3xl font-bold uppercase tracking-[0.08em] text-foreground">
                    {t("title")}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-black/42">
                    {t("subtitle")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-foreground/[0.08] bg-black/[0.035] px-3.5 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-black/44">
                      {currentMode.label}
                    </span>
                  </div>
                  <div className="rounded-full border border-foreground/[0.08] bg-white/[0.26] px-3.5 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-black/44">
                      {matches.length} / {pagination.limit}
                    </span>
                  </div>
                </div>
              </div>
            </ContentHeader>

            <div className="border-b border-foreground/[0.06] px-4 py-4 sm:px-6 sm:py-5">
              <div className="rounded-[24px] border border-foreground/[0.06] bg-[#d4d4d9] p-2 shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
                <div className="flex flex-wrap gap-1.5">
                  {GAME_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleGameTypeChange(type.id)}
                      className={`rounded-[14px] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.22em] transition-all ${gameType === type.id
                        ? "bg-foreground text-white shadow-[0_12px_24px_rgba(0,0,0,0.2)]"
                        : "text-black/42 hover:bg-foreground/[0.04] hover:text-black/62"
                        }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto_auto] xl:items-end">
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.24em] text-foreground/30">
                    {t("map")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("searchMap")}
                    value={mapFilter}
                    onChange={(event) => setMapFilter(event.target.value)}
                    className="w-full rounded-[16px] border border-foreground/[0.08] bg-white/[0.26] px-4 py-3 text-sm text-foreground placeholder:text-black/24 shadow-[0_8px_20px_rgba(0,0,0,0.05)] outline-none transition-colors focus:border-foreground/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.24em] text-foreground/30">
                    {t("dateFrom")}
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="w-full rounded-[16px] border border-foreground/[0.08] bg-white/[0.26] px-4 py-3 text-sm text-foreground shadow-[0_8px_20px_rgba(0,0,0,0.05)] outline-none transition-colors focus:border-foreground/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.24em] text-foreground/30">
                    {t("dateTo")}
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="w-full rounded-[16px] border border-foreground/[0.08] bg-white/[0.26] px-4 py-3 text-sm text-foreground shadow-[0_8px_20px_rgba(0,0,0,0.05)] outline-none transition-colors focus:border-foreground/40"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="rounded-[16px] bg-foreground px-5 py-3 text-[11px] font-bold uppercase tracking-[0.24em] text-white shadow-[0_16px_28px_rgba(0,0,0,0.18)] transition-all hover:bg-[#232328]"
                >
                  {t("search")}
                </button>
                <button
                  onClick={handleClearFilters}
                  className="rounded-[16px] border border-foreground/[0.08] bg-foreground/[0.04] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.24em] text-black/48 transition-all hover:bg-foreground/[0.06] hover:text-black/64"
                >
                  {t("clear")}
                </button>
              </div>

              {hasFilters && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {gameType !== "all" && (
                    <span className="rounded-full border border-foreground/[0.08] bg-black/[0.035] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-black/46">
                      {currentMode.label}
                    </span>
                  )}
                  {mapFilter && (
                    <span className="rounded-full border border-foreground/[0.08] bg-black/[0.035] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-black/46">
                      {t("map")}: {mapFilter}
                    </span>
                  )}
                  {dateFrom && (
                    <span className="rounded-full border border-foreground/[0.08] bg-black/[0.035] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-black/46">
                      {t("dateFrom")}: {dateFrom}
                    </span>
                  )}
                  {dateTo && (
                    <span className="rounded-full border border-foreground/[0.08] bg-black/[0.035] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-black/46">
                      {t("dateTo")}: {dateTo}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="border-b border-foreground/[0.06] px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-black/26">
                    {pagination.totalMatches.toLocaleString()} {t("matchesFound")}
                  </p>
                  <p className="mt-1 text-sm text-black/42">
                    {t("page")} {pagination.page} {t("of")} {pagination.totalPages || 1}
                  </p>
                </div>
                <p className="text-[11px] text-black/32">
                  {matches.length} {t("visibleResults")}
                </p>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {isLoading ? (
                <LoadingScreen compact />
              ) : matches.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-6 py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-foreground/[0.06] bg-white/[0.2]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7 text-black/18">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-black/42">{t("noMatches")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedMatches.map((group) => (
                    <section
                      key={group.key}
                      className="overflow-hidden rounded-[24px] border border-foreground/[0.06] bg-black/[0.018]"
                    >
                      <div className="flex items-center justify-between border-b border-black/[0.05] px-4 py-3 sm:px-5">
                        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-black/42">
                          {group.label}
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-black/24">
                          {group.matches.length}
                        </div>
                      </div>
                      <div className="space-y-3 p-3 sm:p-4">
                        {group.matches.map((match) => (
                          <HistoryMatchCard key={match.id} match={match} locale={locale} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {pagination.totalPages > 1 && (
              <div className="border-t border-foreground/[0.06] px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={!pagination.hasPrev}
                    className="rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-[11px] font-bold text-foreground/50 transition-all hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={!pagination.hasPrev}
                    className="rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/50 transition-all hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {t("prev")}
                  </button>

                  <div className="rounded-[16px] border border-foreground/[0.08] bg-white/[0.24] px-4 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.05)]">
                    <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/52">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                  </div>

                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={!pagination.hasNext}
                    className="rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/50 transition-all hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {t("next")}
                  </button>
                  <button
                    onClick={() => setPage(pagination.totalPages)}
                    disabled={!pagination.hasNext}
                    className="rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2 text-[11px] font-bold text-foreground/50 transition-all hover:bg-foreground/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </ContentContainer>
        </div>
      </div>
    </div>
  )
}
