"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { parseQuakeColors } from "@/lib/quake-colors"
import { PlayerAvatar } from "@/components/player-avatar"
import { FlagClan } from "@/components/flag-clan"
import { IdentityBadges } from "@/components/identity-badges"
import { ContentContainer, ContentHeader } from "@/components/ui/content-container"
import { LoadingScreen } from "@/components/loading-screen"
import { TierBadgeInline } from "@/components/tier-badge"
import { RankValue } from "@/components/rank-value"

interface LadderPlayer {
  playerId: string
  steamId: string
  username: string
  avatar?: string | null
  rating: number
  wins: number
  losses: number
  totalGames: number
  countryCode?: string
  clanTag?: string
  clanSlug?: string | null
  clanAvatarUrl?: string | null
  kills?: number
  deaths?: number
  kdRatio?: number
  damageDealt?: number
  damageTaken?: number
  avgScore?: number
  winRate?: number
  matchCount?: number
  avgKills?: number
  avgDeaths?: number
  avgDamageDealt?: number
  avgDamageTaken?: number
  avgPerformance?: number
  excellents?: number
  impressives?: number
  humiliations?: number
  midairs?: number
  perfects?: number
}

interface LadderClan {
  id: string
  name: string
  tag: string
  slug: string
  avatarUrl: string | null
  avgElo: number
  wins: number
  losses: number
  totalGames?: number
  winRate?: number
  members: number
  activeLadderMembers?: number
  kills?: number
  deaths?: number
  kdRatio?: number
  damageDealt?: number
  damageTaken?: number
}

interface TournamentTeam {
  id: string
  name: string
  tag: string
  slug?: string
  avatarUrl?: string | null
}

interface BracketMatch {
  id: string
  round: number
  matchNumber: number
  bracket: string
  roundText?: string
  status: string
  score1?: number | null
  score2?: number | null
  team1: TournamentTeam | null
  team2: TournamentTeam | null
  winner: TournamentTeam | null
}

interface TournamentTimelineMap {
  id: string
  mapNumber: number
  mapName: string
  score1?: number | null
  score2?: number | null
  status: string
  playedAt?: string | null
}

interface TournamentTimelineMatch {
  id: string
  round: number
  matchNumber: number
  bracket: string
  roundText?: string
  status: string
  score1?: number | null
  score2?: number | null
  team1: TournamentTeam | null
  team2: TournamentTeam | null
  winner: TournamentTeam | null
  completedAt?: string | null
  updatedAt?: string
  scheduledFor?: string | null
  officialDate?: string | null
  tentativeDate?: string | null
  bestOf?: number | null
  maps: TournamentTimelineMap[]
  linkedLadderMatchId?: string | null
  linkedLadderMatchIds?: string[]
}

interface ActiveTournament {
  id: string
  name: string
  slug?: string
  gameType: string
  format: string
  status: string
  startsAt?: string
  imageUrl?: string | null
  notice?: string | null
  totalMatches: number
  completedMatches: number
  pendingMatches: number
  participants: { id: string; team: TournamentTeam }[]
  recentResults: {
    id: string
    team1: TournamentTeam | null
    team2: TournamentTeam | null
    score1?: number | null
    score2?: number | null
    winner: TournamentTeam | null
    round: number
    roundText?: string
  }[]
  bracketMatches: BracketMatch[]
  matchTimeline: {
    played: TournamentTimelineMatch[]
    upcoming: TournamentTimelineMatch[]
  }
}

const GAME_MODES = [
  { id: "ca", label: "Clan Arena", short: "CA" },
  { id: "duel", label: "Duel", short: "DUEL" },
  { id: "tdm", label: "Team Deathmatch", short: "TDM" },
  { id: "ctf", label: "Capture The Flag", short: "CTF" },
  { id: "ffa", label: "Free For All", short: "FFA" },
]

const FORMAT_MAP: Record<string, string> = {
  DOUBLE_ELIMINATION: "doubleElimination",
  SINGLE_ELIMINATION: "singleElimination",
  ROUND_ROBIN: "roundRobin",
  SWISS: "swiss",
}

function TeamAvatar({ team, size = "sm" }: { team: TournamentTeam | null; size?: "xs" | "sm" | "md" }) {
  if (!team) {
    return (
      <div className={`${size === "xs" ? "w-5 h-5" : size === "sm" ? "w-6 h-6" : "w-8 h-8"} rounded bg-foreground/[0.06] flex items-center justify-center`}>
        <span className="text-[8px] text-foreground/20">?</span>
      </div>
    )
  }

  return (
    <FlagClan
      clanTag={team.tag}
      clanName={team.name}
      clanAvatar={team.avatarUrl || undefined}
      size={size}
      showTooltip={false}
    />
  )
}

function TournamentHero({ tournament, players, clans }: { tournament: ActiveTournament; players: LadderPlayer[]; clans: LadderClan[] }) {
  const t = useTranslations("ladder")

  const formatKey = FORMAT_MAP[tournament.format] || tournament.format
  const formatLabel = t(formatKey as any)
  const modeLabel = GAME_MODES.find(m => m.id === tournament.gameType.toLowerCase())?.short || tournament.gameType
  const progress = tournament.totalMatches > 0
    ? Math.round((tournament.completedMatches / tournament.totalMatches) * 100)
    : 0

  return (
    <ContentContainer className="animate-scale-fade [animation-delay:100ms]">
      <div className="p-4 sm:p-6">
        {/* Status badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 bg-foreground text-background text-[9px] font-bold uppercase tracking-wider rounded">
            {t("inProgress")}
          </span>
          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-wider">
            {formatLabel} · {modeLabel}
          </span>
        </div>

        {/* Tournament name */}
        <h2 className="font-tiktok text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground leading-tight">
          {tournament.name}
        </h2>

        {/* Progress bar */}
        <div className="mt-4 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-foreground/40 uppercase font-bold tracking-wider">
              {tournament.completedMatches} {t("of")} {tournament.totalMatches} {t("matchesPlayed")}
            </span>
            <span className="text-[10px] font-bold text-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Aviso especial por incidente */}
        {tournament.notice && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5">
            <p className="text-[11px] text-foreground/60 leading-relaxed normal-case">{tournament.notice}</p>
          </div>
        )}

        {/* Participating teams */}
        {tournament.participants.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {tournament.participants.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 bg-foreground/[0.04] rounded-lg">
                <TeamAvatar team={p.team} size="xs" />
                <span className="text-[10px] font-bold text-foreground/60 uppercase">{p.team.tag}</span>
              </div>
            ))}
            <Link
              href={`/esport/${tournament.slug || tournament.id}`}
              className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors ml-1"
            >
              {t("viewFullBracket")} →
            </Link>
          </div>
        )}
      </div>

      {/* Competitive Stats Grid */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-foreground/[0.06] pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Top Rated Player */}
          {players.length > 0 && (
            <div className="p-3 bg-foreground/[0.03] rounded-lg">
              <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 block mb-1.5">{t("topElo")}</span>
              <div className="flex items-center gap-1.5">
                <PlayerAvatar steamId={players[0].steamId} playerName={players[0].username} avatarUrl={players[0].avatar} size="sm" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-foreground block truncate">{parseQuakeColors(players[0].username)}</span>
                  <span className="text-xs font-bold text-foreground">{Math.round(players[0].rating)}</span>
                </div>
              </div>
            </div>
          )}
          {/* Best K/D */}
          {(() => {
            const bestKd = [...players].filter(p => (p.matchCount || 0) >= 1).sort((a, b) => (b.kdRatio || 0) - (a.kdRatio || 0))[0]
            return bestKd ? (
              <div className="p-3 bg-foreground/[0.03] rounded-lg">
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 block mb-1.5">{t("bestKd")}</span>
                <div className="flex items-center gap-1.5">
                  <PlayerAvatar steamId={bestKd.steamId} playerName={bestKd.username} avatarUrl={bestKd.avatar} size="sm" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-foreground block truncate">{parseQuakeColors(bestKd.username)}</span>
                    <span className="text-xs font-bold text-foreground">{bestKd.kdRatio?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : null
          })()}
          {/* Most Wins */}
          {(() => {
            const mostWins = [...players].sort((a, b) => b.wins - a.wins)[0]
            return mostWins && mostWins.wins > 0 ? (
              <div className="p-3 bg-foreground/[0.03] rounded-lg">
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 block mb-1.5">{t("mostWins")}</span>
                <div className="flex items-center gap-1.5">
                  <PlayerAvatar steamId={mostWins.steamId} playerName={mostWins.username} avatarUrl={mostWins.avatar} size="sm" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-foreground block truncate">{parseQuakeColors(mostWins.username)}</span>
                    <span className="text-xs font-bold text-foreground">{mostWins.wins}W</span>
                  </div>
                </div>
              </div>
            ) : null
          })()}
          {/* Top Damage */}
          {(() => {
            const bestDmg = [...players].filter(p => (p.matchCount || 0) >= 1).sort((a, b) => (b.avgDamageDealt || 0) - (a.avgDamageDealt || 0))[0]
            return bestDmg && bestDmg.avgDamageDealt ? (
              <div className="p-3 bg-foreground/[0.03] rounded-lg">
                <span className="text-[9px] font-bold uppercase tracking-wider text-foreground/30 block mb-1.5">{t("topDmg")}</span>
                <div className="flex items-center gap-1.5">
                  <PlayerAvatar steamId={bestDmg.steamId} playerName={bestDmg.username} avatarUrl={bestDmg.avatar} size="sm" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-foreground block truncate">{parseQuakeColors(bestDmg.username)}</span>
                    <span className="text-xs font-bold text-foreground">{bestDmg.avgDamageDealt.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : null
          })()}
        </div>
      </div>

      {/* Recent Results */}
      {tournament.recentResults.length > 0 && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-foreground/[0.06] pt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 font-tiktok mb-3">
            {t("recentResults")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tournament.recentResults.map(result => {
              const team1Won = result.winner?.id === result.team1?.id
              return (
                <div key={result.id} className="flex items-center gap-2 p-2 bg-foreground/[0.03] rounded-lg">
                  <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                    <span className={`text-[10px] truncate ${team1Won ? "font-bold text-foreground" : "text-foreground/50"}`}>
                      {result.team1?.tag || "TBD"}
                    </span>
                    <TeamAvatar team={result.team1} size="xs" />
                  </div>
                  <div className="flex items-center gap-1 px-1.5 shrink-0">
                    <span className={`text-xs font-bold ${team1Won ? "text-foreground" : "text-foreground/30"}`}>
                      {result.score1 ?? 0}
                    </span>
                    <span className="text-[9px] text-foreground/20">-</span>
                    <span className={`text-xs font-bold ${!team1Won ? "text-foreground" : "text-foreground/30"}`}>
                      {result.score2 ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <TeamAvatar team={result.team2} size="xs" />
                    <span className={`text-[10px] truncate ${!team1Won ? "font-bold text-foreground" : "text-foreground/50"}`}>
                      {result.team2?.tag || "TBD"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </ContentContainer>
  )
}

function UpcomingTournamentBanner({ tournament }: { tournament: { id: string; name: string; slug?: string; gameType: string; format: string; status: string; participantCount: number } }) {
  const t = useTranslations("ladder")
  const modeLabel = GAME_MODES.find(m => m.id === tournament.gameType.toLowerCase())?.short || tournament.gameType

  return (
    <ContentContainer className="animate-scale-fade [animation-delay:150ms]">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 bg-foreground/[0.06] text-foreground/50 text-[9px] font-bold uppercase tracking-wider rounded">
            {tournament.status === "REGISTRATION_OPEN" ? t("registrationOpen") : t("upcomingTournament")}
          </span>
          <span className="text-[10px] font-bold text-foreground/30 uppercase">{modeLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="font-tiktok text-sm font-bold uppercase tracking-wide text-foreground">
            {tournament.name}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-foreground/40">
              {tournament.participantCount} {t("participants")}
            </span>
            {tournament.status === "REGISTRATION_OPEN" && (
              <Link
                href={`/esport/${tournament.slug || tournament.id}`}
                className="text-[10px] font-bold uppercase tracking-wider text-foreground hover:text-foreground/70 transition-colors"
              >
                {t("registerNow")} →
              </Link>
            )}
          </div>
        </div>
      </div>
    </ContentContainer>
  )
}

interface LadderMatchPlayer {
  name: string
  steamId: string
  score: number
  kills: number
  deaths: number
  damageDealt?: number
  clanTag?: string | null
}

interface TeamClan {
  tag: string
  name: string
  avatarUrl: string | null
  slug: string | null
}

interface LadderMatch {
  id: string
  matchId: string
  gameType: string
  map: string
  timestamp: string
  duration?: number | null
  score: string
  player1?: LadderMatchPlayer
  player2?: LadderMatchPlayer
  team1Clan?: TeamClan | null
  team2Clan?: TeamClan | null
  team1Players?: { name: string; steamId: string }[]
  team2Players?: { name: string; steamId: string }[]
}

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
  ironworks: "Iron Works",
  battleforged: "Battle Forged",
  sinister: "Sinister",
  intervention: "Intervention",
  catalyst: "Catalyst",
  courtyard: "Courtyard",
  dreadfulplace: "Dreadful Place",
  furiousheights: "Furious Heights",
  verticalvengeance: "Vertical Vengeance",
  longestyard: "Longest Yard",
  almostlost: "Almost Lost",
}

function formatMapName(map: string) {
  return MAP_NAMES[map.toLowerCase()] || map.charAt(0).toUpperCase() + map.slice(1)
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function formatTimeOnly(timestamp: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function getTournamentMatchMoment(match: TournamentTimelineMatch) {
  return match.completedAt || match.officialDate || match.scheduledFor || match.tentativeDate || match.updatedAt || null
}

function getLocalDateKey(timestamp?: string | null) {
  if (!timestamp) return "unknown"

  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function formatDateGroupLabel(
  timestamp: string | null | undefined,
  locale: string,
  labels: { today: string; yesterday: string; tbd: string }
) {
  if (!timestamp) return labels.tbd

  const date = new Date(timestamp)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const today = new Date()
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((current.getTime() - target.getTime()) / 86_400_000)

  if (diffDays === 0) return labels.today
  if (diffDays === 1) return labels.yesterday

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date)
}

function groupItemsByDate<T>(
  items: T[],
  getTimestamp: (item: T) => string | null | undefined,
  locale: string,
  labels: { today: string; yesterday: string; tbd: string }
) {
  const groups: { key: string; label: string; items: T[] }[] = []

  for (const item of items) {
    const timestamp = getTimestamp(item)
    const key = getLocalDateKey(timestamp)
    const currentGroup = groups[groups.length - 1]

    if (currentGroup && currentGroup.key === key) {
      currentGroup.items.push(item)
      continue
    }

    groups.push({
      key,
      label: formatDateGroupLabel(timestamp, locale, labels),
      items: [item],
    })
  }

  return groups
}

function getTournamentBracketTone(bracket: string) {
  switch (bracket) {
    case "UPPER":
    case "WINNERS":
      return "bg-emerald-500/10 text-emerald-700"
    case "LOWER":
    case "LOSERS":
      return "bg-amber-500/10 text-amber-700"
    default:
      return "bg-foreground/[0.06] text-[var(--qc-text-secondary)]"
  }
}

function ClanBadge({ clan, won, side }: { clan: TeamClan; won: boolean; side: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-1.5 ${side === "left" ? "flex-row-reverse" : ""}`}>
      <FlagClan
        clanTag={clan.tag}
        clanName={clan.name}
        clanAvatar={clan.avatarUrl || undefined}
        size="xs"
        showTooltip={false}
      />
      <span className={`text-xs font-bold uppercase tracking-wider ${won ? "text-foreground" : "text-foreground/40"}`}>
        {clan.tag}
      </span>
    </div>
  )
}

function TournamentTeamPill({
  team,
  won = false,
  side,
}: {
  team: TournamentTeam | null
  won?: boolean
  side: "left" | "right"
}) {
  if (!team) {
    return <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/20">TBD</span>
  }

  return (
    <div className={`flex items-center gap-1.5 ${side === "left" ? "flex-row-reverse" : ""}`}>
      <TeamAvatar team={team} size="xs" />
      <span className={`text-xs font-bold uppercase tracking-wider ${won ? "text-foreground" : "text-foreground/40"}`}>
        {team.tag}
      </span>
    </div>
  )
}

function LadderMatchesList({
  matches,
  pagination,
  isLoading,
  page,
  onPageChange,
}: {
  matches: LadderMatch[]
  pagination?: { page: number; totalPages: number; totalMatches: number; hasNext: boolean; hasPrev: boolean }
  isLoading: boolean
  page: number
  onPageChange: (p: number) => void
}) {
  const t = useTranslations("ladder")
  const locale = useLocale()
  const dateGroups = groupItemsByDate(matches, (match) => match.timestamp, locale, {
    today: t("today"),
    yesterday: t("yesterday"),
    tbd: t("tbd"),
  })

  if (isLoading) return <LoadingScreen compact />

  if (matches.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-foreground/30 text-xs">{t("noMatches")}</p>
      </div>
    )
  }

  return (
    <div>
      {dateGroups.map((group, groupIndex) => (
        <div key={group.key} className={groupIndex !== 0 ? "border-t border-foreground/[0.06]" : ""}>
          <div className="px-4 sm:px-5 py-3 bg-foreground/[0.02] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-muted)]">
              {group.label}
            </span>
            <span className="text-[10px] text-[var(--qc-text-muted)]">
              {group.items.length}
            </span>
          </div>

          {group.items.map((match, index) => {
            const [s1, s2] = match.score.split("-").map(Number)
            const team1Won = s1 > s2
            const team2Won = s2 > s1

            return (
              <Link
                key={match.id}
                href={`/match/${match.matchId}`}
                className={`block px-4 sm:px-5 py-4 hover:bg-foreground/[0.03] transition-all group ${index !== group.items.length - 1 ? "border-b border-foreground/[0.04]" : ""}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="sm:w-28 lg:w-36 flex-shrink-0">
                    <p className="text-[10px] text-foreground/30 font-mono">
                      {formatTimeOnly(match.timestamp, locale)}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="w-6 h-4 rounded overflow-hidden bg-foreground/[0.08] flex-shrink-0 hidden sm:block">
                        <img
                          src={`/levelshots/${match.map.toLowerCase()}.jpg`}
                          alt={match.map}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/levelshots/default.jpg" }}
                        />
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-foreground/40 truncate">
                        {formatMapName(match.map)}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--qc-text-muted)]">
                      {match.gameType}
                      {match.duration ? ` · ${formatDuration(match.duration)}` : ""}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    {match.player1 && match.player2 ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                          {match.player1.clanTag && (
                            <span className="text-[9px] font-bold text-foreground/20 uppercase hidden sm:inline">
                              {match.player1.clanTag}
                            </span>
                          )}
                          <span className={`text-xs truncate text-shadow-sm ${team1Won ? "font-bold text-foreground" : "text-foreground/40"}`}>
                            {parseQuakeColors(match.player1.name)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-1.5 shrink-0">
                          <span className={`text-base font-bold tabular-nums ${team1Won ? "text-foreground" : "text-foreground/25"}`}>
                            {s1}
                          </span>
                          <span className="text-[9px] text-foreground/15 font-bold uppercase">{t("vs")}</span>
                          <span className={`text-base font-bold tabular-nums ${team2Won ? "text-foreground" : "text-foreground/25"}`}>
                            {s2}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`text-xs truncate text-shadow-sm ${team2Won ? "font-bold text-foreground" : "text-foreground/40"}`}>
                            {parseQuakeColors(match.player2.name)}
                          </span>
                          {match.player2.clanTag && (
                            <span className="text-[9px] font-bold text-foreground/20 uppercase hidden sm:inline">
                              {match.player2.clanTag}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
                          {match.team1Clan ? (
                            <ClanBadge clan={match.team1Clan} won={team1Won} side="left" />
                          ) : (
                            <div className="hidden sm:flex items-center gap-1">
                              {match.team1Players?.slice(0, 3).map((p) => (
                                <span key={p.steamId} className={`text-[10px] truncate max-w-[60px] ${team1Won ? "text-foreground/60" : "text-foreground/30"}`}>
                                  {parseQuakeColors(p.name)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 px-1.5 shrink-0">
                          <span className={`text-base font-bold tabular-nums ${team1Won ? "text-foreground" : "text-foreground/25"}`}>
                            {s1}
                          </span>
                          <span className="text-[9px] text-foreground/15 font-bold uppercase">{t("vs")}</span>
                          <span className={`text-base font-bold tabular-nums ${team2Won ? "text-foreground" : "text-foreground/25"}`}>
                            {s2}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {match.team2Clan ? (
                            <ClanBadge clan={match.team2Clan} won={team2Won} side="right" />
                          ) : (
                            <div className="hidden sm:flex items-center gap-1">
                              {match.team2Players?.slice(0, 3).map((p) => (
                                <span key={p.steamId} className={`text-[10px] truncate max-w-[60px] ${team2Won ? "text-foreground/60" : "text-foreground/30"}`}>
                                  {parseQuakeColors(p.name)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-4 text-foreground/10 group-hover:text-foreground transition-colors flex-shrink-0 self-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ))}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 sm:px-5 py-3 border-t border-foreground/[0.06] flex items-center justify-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={!pagination.hasPrev}
            className="px-2.5 py-1.5 text-[11px] font-bold bg-foreground/[0.05] text-foreground/50 hover:bg-foreground/[0.09] disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
          >
            «
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!pagination.hasPrev}
            className="px-3 py-1.5 text-[11px] font-bold uppercase bg-foreground/[0.05] text-foreground/50 hover:bg-foreground/[0.09] disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
          >
            {t("prev")}
          </button>
          <span className="px-3 py-1.5 text-[11px] font-bold text-foreground/40">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!pagination.hasNext}
            className="px-3 py-1.5 text-[11px] font-bold uppercase bg-foreground/[0.05] text-foreground/50 hover:bg-foreground/[0.09] disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
          >
            {t("next")}
          </button>
          <button
            onClick={() => onPageChange(pagination.totalPages)}
            disabled={!pagination.hasNext}
            className="px-2.5 py-1.5 text-[11px] font-bold bg-foreground/[0.05] text-foreground/50 hover:bg-foreground/[0.09] disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
          >
            »
          </button>
        </div>
      )}
    </div>
  )
}

function TournamentMatchesTimeline({ tournament }: { tournament: ActiveTournament }) {
  const t = useTranslations("ladder")
  const locale = useLocale()
  const playedMatches = tournament.matchTimeline?.played || []
  const upcomingMatches = tournament.matchTimeline?.upcoming || []
  const dateLabels = {
    today: t("today"),
    yesterday: t("yesterday"),
    tbd: t("tbd"),
  }
  const playedGroups = groupItemsByDate(playedMatches, getTournamentMatchMoment, locale, dateLabels)
  const upcomingGroups = groupItemsByDate(upcomingMatches, getTournamentMatchMoment, locale, dateLabels)

  const renderTimelineRow = (match: TournamentTimelineMatch, index: number, played: boolean) => {
    const score1 = match.score1 ?? 0
    const score2 = match.score2 ?? 0
    const team1Won = played && score1 > score2
    const team2Won = played && score2 > score1
    const moment = getTournamentMatchMoment(match)
    const roundLabel = match.roundText || `${t("matches")} #${match.matchNumber}`
    const linkedMatchCount = match.linkedLadderMatchIds?.length || match.maps.length
    const detailHref = played && match.linkedLadderMatchId ? `/match/${match.linkedLadderMatchId}` : null

    const rowContent = (
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="sm:w-32 lg:w-36 flex-shrink-0">
          <p className="text-[10px] text-foreground/30 font-mono">
            {moment ? formatTimeOnly(moment, locale) : t("tbd")}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--qc-text-muted)]">
            {roundLabel}
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
              <TournamentTeamPill team={match.team1} won={team1Won} side="left" />
            </div>

            <div className="flex items-center gap-1.5 px-1 shrink-0">
              {played ? (
                <>
                  <span className={`text-base font-bold tabular-nums ${team1Won ? "text-foreground" : "text-foreground/25"}`}>
                    {score1}
                  </span>
                  <span className="text-[9px] text-foreground/15 font-bold uppercase">{t("vs")}</span>
                  <span className={`text-base font-bold tabular-nums ${team2Won ? "text-foreground" : "text-foreground/25"}`}>
                    {score2}
                  </span>
                </>
              ) : (
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/20">{t("vs")}</span>
              )}
            </div>

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <TournamentTeamPill team={match.team2} won={team2Won} side="right" />
            </div>
          </div>
        </div>

        <div className="sm:w-32 flex-shrink-0 flex items-center justify-between sm:justify-end gap-2">
          {played && linkedMatchCount > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--qc-text-muted)]">
              {linkedMatchCount} {linkedMatchCount === 1 ? t("map") : t("maps")}
            </span>
          )}
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${getTournamentBracketTone(match.bracket)}`}>
            {match.bracket}
          </span>
          {detailHref && (
            <svg
              className="w-3.5 h-3.5 text-foreground/18 group-hover:text-foreground/45 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    )

    if (detailHref) {
      return (
      <Link
        key={match.id}
        href={detailHref}
        className={`group block px-4 sm:px-5 py-3.5 hover:bg-foreground/[0.02] transition-colors ${index !== 0 ? "border-t border-foreground/[0.04]" : ""}`}
      >
        {rowContent}
      </Link>
      )
    }

    return (
      <div
        key={match.id}
        className={`px-4 sm:px-5 py-3.5 ${index !== 0 ? "border-t border-foreground/[0.04]" : ""}`}
      >
        {rowContent}
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-5 py-4 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          {playedMatches.length > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700">
              {playedMatches.length} {t("playedSeries")}
            </span>
          )}
          {upcomingMatches.length > 0 && (
            <span className="rounded-full bg-foreground/[0.05] px-2.5 py-1 text-[var(--qc-text-secondary)]">
              {upcomingMatches.length} {t("upcomingSeries")}
            </span>
          )}
        </div>
        <Link
          href={`/esport/${tournament.slug || tournament.id}`}
          className="text-[10px] font-bold uppercase tracking-wider text-foreground/55 hover:text-foreground transition-colors"
        >
          {t("viewFullBracket")} →
        </Link>
      </div>

      <div className="space-y-5">
        {playedMatches.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--qc-text-muted)]">
                {t("playedSeries")}
              </span>
            </div>

            {playedGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                {playedGroups.length > 1 && group.label !== t("today") && (
                  <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                    {group.label}
                  </p>
                )}
                <div className="overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02]">
                  {group.items.map((match, index) => renderTimelineRow(match, index, true))}
                </div>
              </div>
            ))}
          </section>
        ) : (
          <div className="py-10 text-center">
            <p className="text-foreground/30 text-xs">{t("noTournamentMatches")}</p>
          </div>
        )}

        {upcomingMatches.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--qc-text-muted)]">
                {t("upcomingSeries")}
              </span>
            </div>

            {upcomingGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                {upcomingGroups.length > 1 && group.label !== t("today") && (
                  <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-foreground/30">
                    {group.label}
                  </p>
                )}
                <div className="overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02]">
                  {group.items.map((match, index) => renderTimelineRow(match, index, false))}
                </div>
              </div>
            ))}
          </section>
        ) : playedMatches.length > 0 ? null : (
          <div className="py-10 text-center">
            <p className="text-foreground/30 text-xs">{t("noUpcomingMatches")}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LadderPage() {
  const t = useTranslations("ladder")
  const [gameType, setGameType] = useState("ca")
  const [view, setView] = useState<"players" | "clans" | "matches">("players")
  const [matchPage, setMatchPage] = useState(1)

  // Fetch active tournament data
  const { data: tournamentData } = useQuery({
    queryKey: ["ladder-active-tournament"],
    queryFn: async () => {
      const res = await fetch("/api/ladder/active-tournament")
      if (!res.ok) return { active: [], upcoming: [], lastCompleted: null }
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const activeTournament: ActiveTournament | null = tournamentData?.active?.[0] || null
  const upcomingTournaments = tournamentData?.upcoming || []

  // If there's an active tournament, lock to its gameType
  const effectiveGameType = activeTournament
    ? activeTournament.gameType.toLowerCase()
    : gameType

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const [hashView, hashMode] = hash.split("-")

    if (hashView === "clans" || hashView === "clanes") {
      setView("clans")
    } else if (hashView === "matches" || hashView === "partidos") {
      setView("matches")
    } else if (hashView === "players" || hashView === "jugadores") {
      setView("players")
    }

    if (hashMode && GAME_MODES.some((m) => m.id === hashMode)) {
      setGameType(hashMode)
    }
  }, [])

  useEffect(() => {
    window.history.replaceState(null, "", `#${view}-${effectiveGameType}`)
  }, [view, effectiveGameType])

  const { data: userData } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me")
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: ladderData, isLoading } = useQuery({
    queryKey: ["ladder", effectiveGameType],
    queryFn: async () => {
      const res = await fetch(`/api/ladder?gameType=${effectiveGameType}`)
      if (!res.ok) return { players: [], clans: [] }
      return res.json()
    },
    staleTime: 60 * 1000,
  })

  const { data: matchesData, isLoading: isLoadingMatches } = useQuery({
    queryKey: ["ladder-matches", effectiveGameType, matchPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: matchPage.toString(),
        limit: "20",
        gameType: effectiveGameType,
      })
      const res = await fetch(`/api/ladder/matches?${params}`)
      if (!res.ok) return { matches: [], pagination: { page: 1, totalPages: 0, totalMatches: 0, hasNext: false, hasPrev: false } }
      return res.json()
    },
    staleTime: 60 * 1000,
    enabled: view === "matches" && !activeTournament,
  })

  const players: LadderPlayer[] = ladderData?.players || []
  const clans: LadderClan[] = ladderData?.clans || []
  const tournamentPlayedCount = activeTournament?.matchTimeline?.played?.length || 0

  const currentMode = GAME_MODES.find((m) => m.id === effectiveGameType)

  return (
    <div className="relative min-h-screen">

      <div className="pt-8 sm:pt-12 mx-auto w-full max-w-[1400px] px-3 sm:px-6 md:px-8 pb-12">
        <div className="max-w-[960px] mx-auto space-y-4 sm:space-y-5">

          {/* Page Header — same ContentHeader pattern as Rankings */}
          <ContentContainer className="animate-scale-fade">
            <ContentHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative">
              <div>
                <h1 className="font-tiktok text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground">
                  {t("title")}
                </h1>
                <p className="text-xs text-foreground/40 mt-1">{t("subtitle")}</p>
              </div>
              {/* Game mode pills */}
              <div className="flex items-center gap-1 overflow-x-auto mobile-hide-scrollbar">
                {GAME_MODES.map((mode) => {
                  const isActive = effectiveGameType === mode.id
                  const isLocked = activeTournament && mode.id !== activeTournament.gameType.toLowerCase()
                  return (
                    <button
                      key={mode.id}
                      onClick={() => !isLocked && setGameType(mode.id)}
                      disabled={!!isLocked}
                      className={`flex-shrink-0 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${isActive
                        ? "bg-foreground text-background"
                        : isLocked
                          ? "text-[var(--qc-text-subtle)]/40 cursor-not-allowed"
                          : "text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.04]"
                        }`}
                    >
                      {mode.short}
                    </button>
                  )
                })}
              </div>
            </ContentHeader>
          </ContentContainer>

          {/* Active Tournament Hero (compact) */}
          {activeTournament && (
            <TournamentHero tournament={activeTournament} players={players} clans={clans} />
          )}

          {/* Upcoming tournaments */}
          {upcomingTournaments.map((ut: any) => (
            <UpcomingTournamentBanner key={ut.id} tournament={ut} />
          ))}

          {/* No tournament fallback */}
          {!activeTournament && upcomingTournaments.length === 0 && tournamentData && (
            <ContentContainer className="animate-scale-fade [animation-delay:100ms]">
              <div className="p-6 text-center">
                <p className="text-xs text-foreground/30 uppercase font-bold tracking-wider">{t("noActiveTournament")}</p>
                <p className="text-[11px] text-foreground/20 mt-1">{t("noActiveTournamentDesc")}</p>
                {tournamentData.lastCompleted && (
                  <Link
                    href={`/esport/${tournamentData.lastCompleted.slug || tournamentData.lastCompleted.id}`}
                    className="inline-block mt-3 text-[10px] font-bold uppercase tracking-wider text-foreground/60 hover:text-foreground transition-colors"
                  >
                    {t("lastCompleted")}: {tournamentData.lastCompleted.name} →
                  </Link>
                )}
              </div>
            </ContentContainer>
          )}

          {/* Ladder Ranking — full width, OP.GG style */}
          <ContentContainer className="animate-scale-fade [animation-delay:200ms]">

            {/* View tabs bar */}
            <div className="px-4 sm:px-5 py-3 border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)]">
              <div className="flex items-center justify-between">
                {/* Players / Clans toggle */}
                <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5">
                  <button
                    onClick={() => setView("players")}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${view === "players"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-foreground/40"
                      }`}
                  >
                    {t("players")} <span className="text-[9px] ml-0.5 opacity-60">{players.length}</span>
                  </button>
                  <button
                    onClick={() => setView("clans")}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${view === "clans"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-foreground/40"
                      }`}
                  >
                    {t("clans")} <span className="text-[9px] ml-0.5 opacity-60">{clans.length}</span>
                  </button>
                  <button
                    onClick={() => { setView("matches"); setMatchPage(1) }}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${view === "matches"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-foreground/40"
                      }`}
                  >
                    {t("matches")}
                    <span className="text-[9px] ml-0.5 opacity-60">
                      {activeTournament ? tournamentPlayedCount : matchesData?.pagination?.totalMatches || 0}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            {(view === "players" || view === "clans") && isLoading ? (
              <LoadingScreen compact />
            ) : view === "matches" ? (
              activeTournament ? (
                <TournamentMatchesTimeline tournament={activeTournament} />
              ) : (
                /* Matches List */
                <LadderMatchesList
                  matches={matchesData?.matches || []}
                  pagination={matchesData?.pagination}
                  isLoading={isLoadingMatches}
                  page={matchPage}
                  onPageChange={setMatchPage}
                />
              )
            ) : view === "players" ? (
              /* Players Table */
              <div>
                {/* Table header */}
                <div className="grid grid-cols-[32px_1fr_44px_50px] sm:grid-cols-[36px_1fr_36px_52px_48px_52px] lg:grid-cols-[36px_1fr_36px_56px_48px_52px_48px_64px_40px] gap-1 sm:gap-2 px-4 sm:px-5 py-2 text-[9px] font-bold uppercase text-[var(--qc-text-muted)] tracking-wider border-b border-foreground/[0.06]">
                  <div className="text-center">#</div>
                  <div>{t("player")}</div>
                  <div className="text-center hidden sm:block">TIER</div>
                  <div className="text-center">ELO</div>
                  <div className="text-center hidden sm:block">K/D</div>
                  <div className="hidden sm:block text-center">{t("wl")}</div>
                  <div className="hidden lg:block text-center">WIN%</div>
                  <div className="hidden lg:block text-center">AVG DMG</div>
                  <div className="hidden lg:block text-center">{t("games")}</div>
                </div>

                {players.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-[var(--qc-text-muted)] text-[11px]">{t("noPlayersIn")} {currentMode?.short}</p>
                  </div>
                ) : (
                  <div>
                    {players.map((player, index) => (
                      <Link
                        key={player.playerId}
                        href={`/perfil/${player.steamId}`}
                        className="grid grid-cols-[32px_1fr_44px_50px] sm:grid-cols-[36px_1fr_36px_52px_48px_52px] lg:grid-cols-[36px_1fr_36px_56px_48px_52px_48px_64px_40px] gap-1 sm:gap-2 items-center px-4 sm:px-5 py-2.5 hover:bg-foreground/[0.02] transition-all border-b border-foreground/[0.05] group"
                      >
                        <RankValue rank={index + 1} totalPlayers={players.length} className="text-center text-xs" showHash={false} />
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar
                            steamId={player.steamId}
                            playerName={player.username}
                            avatarUrl={player.avatar}
                            size="sm"
                          />
                          <IdentityBadges
                            countryCode={player.countryCode}
                            countryName={player.countryCode}
                            clanTag={player.clanTag}
                            clanName={player.clanTag}
                            clanAvatar={player.clanAvatarUrl || undefined}
                            size="sm"
                            showTooltips={false}
                            className="min-w-0"
                            clanClassName="hidden sm:inline-flex"
                          />
                          <span className="text-xs text-foreground/80 truncate group-hover:text-foreground transition-colors text-shadow-sm">
                            {parseQuakeColors(player.username)}
                          </span>
                        </div>
                        <span className="icon-shadow hidden sm:block"><TierBadgeInline elo={Math.round(player.rating)} gameType={effectiveGameType} size="md" /></span>
                        <span className="text-xs text-center text-foreground font-bold text-shadow-sm">
                          {Math.round(player.rating)}
                        </span>
                        <span className="text-[11px] text-center font-medium text-foreground/50 hidden sm:block">
                          {player.kdRatio?.toFixed(2) || "-"}
                        </span>
                        <span className="hidden sm:block text-[11px] text-center text-foreground/50">
                          {player.wins}-{player.losses}
                        </span>
                        <span className="hidden lg:block text-[11px] text-center text-foreground/50">
                          {player.winRate ? `${player.winRate}%` : "-"}
                        </span>
                        <span className="hidden lg:block text-[11px] text-center text-foreground/50">
                          {player.avgDamageDealt ? player.avgDamageDealt.toLocaleString() : "-"}
                        </span>
                        <span className="hidden lg:block text-[11px] text-center text-foreground/40">
                          {player.matchCount || 0}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Clans Table */
              <div>
                {/* Table header */}
                <div className="grid grid-cols-[32px_1fr_36px_52px_48px_52px] lg:grid-cols-[32px_1fr_36px_56px_48px_48px_52px_40px] gap-2 px-4 sm:px-5 py-2 text-[9px] font-bold uppercase text-[var(--qc-text-muted)] tracking-wider border-b border-foreground/[0.06]">
                  <div className="text-center">#</div>
                  <div>{t("clan")}</div>
                  <div className="text-center">TIER</div>
                  <div className="text-center">ELO</div>
                  <div className="text-center">K/D</div>
                  <div className="hidden lg:block text-center">WIN%</div>
                  <div className="text-center">{t("wl")}</div>
                  <div className="hidden lg:block text-center">{t("games")}</div>
                </div>

                {clans.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-[var(--qc-text-muted)] text-[11px]">{t("noClans")}</p>
                  </div>
                ) : (
                  <div>
                    {clans.map((clan, index) => (
                      <Link
                        key={clan.id}
                        href={`/clanes/${clan.slug}`}
                        className="grid grid-cols-[32px_1fr_36px_52px_48px_52px] lg:grid-cols-[32px_1fr_36px_56px_48px_48px_52px_40px] gap-2 items-center px-4 sm:px-5 py-2.5 hover:bg-foreground/[0.02] transition-all border-b border-foreground/[0.05] group"
                      >
                        <RankValue rank={index + 1} totalPlayers={clans.length} className="text-center text-xs" showHash={false} />
                        <div className="flex items-center gap-3 min-w-0">
                          <FlagClan
                            clanTag={clan.tag}
                            clanName={clan.name}
                            clanAvatar={clan.avatarUrl || undefined}
                            size="sm"
                            showTooltip={false}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-foreground/80 truncate group-hover:text-foreground transition-colors block text-shadow-sm">
                              {clan.name}
                            </span>
                            <span className="text-[9px] text-foreground/30">
                              {clan.activeLadderMembers || 0}/{clan.members} {t("active")}
                            </span>
                          </div>
                        </div>
                        <span className="icon-shadow"><TierBadgeInline elo={clan.avgElo} gameType={effectiveGameType} size="md" /></span>
                        <span className="text-xs text-center text-foreground font-bold text-shadow-sm">
                          {Math.round(clan.avgElo)}
                        </span>
                        <span className="text-[11px] text-center font-medium text-foreground/50">
                          {clan.kdRatio ? clan.kdRatio.toFixed(2) : "-"}
                        </span>
                        <span className="hidden lg:block text-[11px] text-center text-foreground/50">
                          {clan.winRate ? `${clan.winRate}%` : "-"}
                        </span>
                        <span className="text-[11px] text-center text-foreground/50">
                          {clan.wins}-{clan.losses}
                        </span>
                        <span className="hidden lg:block text-[11px] text-center text-foreground/40">
                          {clan.totalGames || 0}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom info bar */}
            <div className="px-4 sm:px-5 py-2.5 border-t border-foreground/[0.06] bg-[var(--qc-bg-pure)] flex items-center justify-between">
              <span className="text-[9px] text-[var(--qc-text-muted)]">{t("infoCompetitive")} {t("infoInitialElo")}</span>
              <div className="flex items-center gap-3 text-[9px] text-[var(--qc-text-muted)]">
                <span>{players.length} {t("activePlayers").toLowerCase()}</span>
                <span>{clans.length} {t("clans").toLowerCase()}</span>
                <span>{players.reduce((sum, p) => sum + p.totalGames, 0)} {t("totalGames").toLowerCase()}</span>
              </div>
            </div>

          </ContentContainer>

        </div>
      </div>

    </div>
  )
}
