"use client"

import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import { FlagClan } from "@/components/flag-clan"

interface EliminationBracketProps {
    tournamentId: string
    format?: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION'
}

interface Match {
    id: string
    round: number
    matchNumber: number
    bracket: 'UPPER' | 'LOWER'
    status: string
    nextMatchId?: string | null
    score1?: number
    score2?: number
    winnerId?: string
    roundText?: string
    participant1Id?: string
    participant2Id?: string
    participant1Reg?: {
        id: string
        seed?: number | null
        clan?: { tag: string; name: string; avatarUrl?: string }
        player?: { username: string; avatar?: string }
        tournamentTeam?: { id: string; tag: string; name: string; avatarUrl?: string }
    }
    participant2Reg?: {
        id: string
        seed?: number | null
        clan?: { tag: string; name: string; avatarUrl?: string }
        player?: { username: string; avatar?: string }
        tournamentTeam?: { id: string; tag: string; name: string; avatarUrl?: string }
    }
    winner?: {
        id: string
        seed?: number | null
        clan?: { tag: string; name: string; avatarUrl?: string }
        player?: { username: string; avatar?: string }
        tournamentTeam?: { id: string; tag: string; name: string; avatarUrl?: string }
    }
}

// Constants for bracket dimensions
const MATCH_HEIGHT = 78
const MATCH_HEIGHT_COMPACT = 70
const MATCH_WIDTH = 232
const MATCH_WIDTH_COMPACT = 208
const CONNECTOR_WIDTH = 72
const CONNECTOR_WIDTH_COMPACT = 58
const BASE_GAP = 16
const BASE_GAP_COMPACT = 12

function getTeamName(reg: Match['participant1Reg']): string {
    if (!reg) return 'TBD'
    return reg.tournamentTeam?.tag || reg.clan?.tag || reg.player?.username || 'TBD'
}

function getTeamAvatar(reg: Match['participant1Reg']): string | null {
    if (!reg) return null
    return reg.tournamentTeam?.avatarUrl || reg.clan?.avatarUrl || reg.player?.avatar || null
}

function isClanLike(reg: Match['participant1Reg']): boolean {
    return Boolean(reg?.tournamentTeam || reg?.clan)
}

function TeamMark({
    reg,
    compact = false,
    showTooltip = false,
}: {
    reg: Match['participant1Reg']
    compact?: boolean
    showTooltip?: boolean
}) {
    if (!reg) {
        return <div className={`${compact ? 'w-[18px] h-[18px]' : 'w-5 h-5'} rounded bg-foreground/[0.08] flex-shrink-0`} />
    }

    if (isClanLike(reg)) {
        return (
            <FlagClan
                clanTag={getTeamName(reg)}
                clanName={reg.tournamentTeam?.name || reg.clan?.name || getTeamName(reg)}
                clanAvatar={getTeamAvatar(reg) || undefined}
                size={compact ? "xs" : "sm"}
                showTooltip={showTooltip}
            />
        )
    }

    if (getTeamAvatar(reg)) {
        return (
            <div className={`relative ${compact ? 'w-[18px] h-[18px]' : 'w-5 h-5'} flex-shrink-0 overflow-hidden rounded`}>
                <Image
                    src={getTeamAvatar(reg)!}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                />
            </div>
        )
    }

    return <div className={`${compact ? 'w-[18px] h-[18px]' : 'w-5 h-5'} rounded bg-foreground/[0.08] flex-shrink-0`} />
}

// Match Card Component with SVG connectors tuned for the public bracket view
function MatchCard({ 
    match, 
    compact = false,
    matchIndex = 0,
    totalMatchesInRound = 1,
    isLastRound = false,
    isLower = false,
    actualGap = 0,
    isMerging = false
}: { 
    match: Match
    compact?: boolean
    matchIndex?: number
    totalMatchesInRound?: number
    isLastRound?: boolean
    isLower?: boolean
    actualGap?: number
    isMerging?: boolean
}) {
    const team1 = match.participant1Reg
    const team2 = match.participant2Reg
    const isCompleted = match.status === 'COMPLETED' || match.status === 'WALKOVER'
    const isBye = match.status === 'BYE'
    const team1Won = isCompleted && match.winnerId === team1?.id
    const team2Won = isCompleted && match.winnerId === team2?.id

    const matchHeight = compact ? MATCH_HEIGHT_COMPACT : MATCH_HEIGHT
    const matchWidth = compact ? MATCH_WIDTH_COMPACT : MATCH_WIDTH
    const connectorWidth = compact ? CONNECTOR_WIDTH_COMPACT : CONNECTOR_WIDTH

    // Show connector for any match that feeds into the next round
    const showConnector = !isLastRound && Boolean(match.nextMatchId)
    const usesMergedConnector = isMerging
    const isTopOfPair = matchIndex % 2 === 0

    // Height from match center to the midpoint where connectors meet
    const halfMatchHeight = matchHeight / 2
    const connectorVerticalSpan = halfMatchHeight + actualGap / 2

    const connectorColor = isLower ? 'rgba(239, 68, 68, 0.38)' : 'var(--border)'
    const connectorGlow = ''
    const connectorHeight = usesMergedConnector ? connectorVerticalSpan * 2 : matchHeight
    const connectorJointX = Math.round(connectorWidth * (compact ? 0.34 : 0.38))
    const connectorMidY = Math.round(usesMergedConnector ? connectorVerticalSpan : matchHeight / 2)
    const connectorReach = connectorWidth + (compact ? 34 : 24)
    const connectorPath = !usesMergedConnector
        ? `M 0 ${connectorMidY} H ${connectorReach}`
        : isTopOfPair
            ? `M 0 1 H ${connectorJointX} V ${connectorMidY} H ${connectorReach}`
            : `M 0 ${connectorHeight - 1} H ${connectorJointX} V ${connectorMidY} H ${connectorReach}`

    const connector = showConnector ? (
        <svg
            className={`absolute pointer-events-none overflow-visible ${connectorGlow}`}
            style={{
                left: matchWidth - 1,
                ...(
                    !usesMergedConnector
                        ? { top: 0 }
                        : isTopOfPair
                            ? { top: '50%' }
                            : { bottom: '50%' }
                ),
                width: connectorReach + 6,
                height: connectorHeight,
            }}
            viewBox={`0 0 ${connectorReach + 6} ${connectorHeight}`}
            fill="none"
        >
            <path
                d={connectorPath}
                stroke={connectorColor}
                strokeWidth="1"
                strokeOpacity={isLower ? 1 : 0.85}
            />
        </svg>
    ) : null

    if (isBye && (!team1 || !team2)) {
        const team = team1 || team2
        const byeLabel = team
            ? match.winnerId
                ? 'Avanza por bye'
                : 'Espera rival'
            : match.nextMatchId
                ? 'Pendiente'
                : 'Slot inactivo'

        return (
            <div className="relative flex items-center">
                <div 
                    className={`rounded-xl border shadow-[0_8px_20px_rgba(0,0,0,0.04)] ${team ? 'border-foreground/[0.08] bg-card' : 'border-foreground/[0.04] bg-foreground/[0.03] opacity-70'} flex items-center`}
                    style={{ width: matchWidth, height: matchHeight }}
                >
                    {team ? (
                        <>
                            <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
                                <TeamMark reg={team} compact={compact} />
                                <div className="min-w-0">
                                    <span className="block truncate text-[11px] font-semibold tracking-wide text-foreground/80">
                                        {getTeamName(team)}
                                    </span>
                                    <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-foreground/45">
                                        {byeLabel}
                                    </span>
                                </div>
                            </div>
                            <div className="mr-3 rounded-full border border-foreground/[0.08] bg-foreground/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/55">
                                BYE
                            </div>
                        </>
                    ) : (
                        <div className="px-3 text-[10px] uppercase italic tracking-[0.18em] text-foreground/28">
                            {byeLabel}
                        </div>
                    )}
                </div>
                {connector}
            </div>
        )
    }

    return (
        <div className="relative flex items-center">
            <div 
                className="overflow-hidden rounded-xl border border-foreground/[0.06] bg-card shadow-[0_10px_28px_rgba(0,0,0,0.06)]"
                style={{ width: matchWidth, height: matchHeight }}
            >
                {/* Team 1 */}
                <div 
                    className={`flex items-center h-1/2 transition-colors ${team1Won ? 'bg-foreground/8' : 'hover:bg-foreground/[0.03]'}`}
                >
                    <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                        <TeamMark reg={team1} compact={compact} />
                        <span className={`${compact ? 'text-[11px]' : 'text-[13px]'} truncate ${
                            team1Won ? 'text-foreground font-bold' : team1 ? 'text-foreground/80' : 'text-foreground/30'
                        }`}>
                            {getTeamName(team1)}
                        </span>
                    </div>
                    <div className={`${compact ? 'w-9' : 'w-11'} h-full flex items-center justify-center ${compact ? 'text-sm' : 'text-base'} font-bold border-l border-foreground/[0.06] ${
                        team1Won ? 'bg-foreground text-background' : 'bg-[var(--qc-bg-pure)] text-foreground/45'
                    }`}>
                        {isCompleted ? (match.score1 ?? 0) : '-'}
                    </div>
                </div>
                
                <div className="h-px bg-foreground/[0.06]" />
                
                {/* Team 2 */}
                <div 
                    className={`flex items-center h-1/2 transition-colors ${team2Won ? 'bg-foreground/8' : 'hover:bg-foreground/[0.03]'}`}
                >
                    <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                        <TeamMark reg={team2} compact={compact} />
                        <span className={`${compact ? 'text-[11px]' : 'text-[13px]'} truncate ${
                            team2Won ? 'text-foreground font-bold' : team2 ? 'text-foreground/80' : 'text-foreground/30'
                        }`}>
                            {getTeamName(team2)}
                        </span>
                    </div>
                    <div className={`${compact ? 'w-9' : 'w-11'} h-full flex items-center justify-center ${compact ? 'text-sm' : 'text-base'} font-bold border-l border-foreground/[0.06] ${
                        team2Won ? 'bg-foreground text-background' : 'bg-[var(--qc-bg-pure)] text-foreground/45'
                    }`}>
                        {isCompleted ? (match.score2 ?? 0) : '-'}
                    </div>
                </div>
            </div>

            {connector}
        </div>
    )
}

// Champion Card
function ChampionCard({ winner }: { winner: Match['participant1Reg'] | null }) {
    if (!winner) {
        return (
            <div className="text-center px-5">
                <div className="text-[10px] font-bold text-[var(--qc-text-muted)] uppercase tracking-wider mb-3 font-tiktok">
                    Campeón
                </div>
                <div className="relative w-20 h-20 mx-auto border-2 border-dashed border-foreground/[0.12] flex items-center justify-center bg-foreground/[0.03] rounded-2xl">
                    <span className="text-2xl text-foreground/20">?</span>
                </div>
            </div>
        )
    }

    const name = getTeamName(winner)
    const avatar = getTeamAvatar(winner)

    return (
        <div className="text-center px-5">
            <div className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-3 font-tiktok">
                Campeón
            </div>
            <div className="relative mx-auto flex min-h-[80px] w-[108px] items-center justify-center rounded-2xl border border-foreground/[0.12] bg-[var(--qc-bg-pure)] shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                {isClanLike(winner) ? (
                    <FlagClan
                        clanTag={name}
                        clanName={winner?.tournamentTeam?.name || winner?.clan?.name || name}
                        clanAvatar={avatar || undefined}
                        size="lg"
                        showTooltip={false}
                    />
                ) : avatar ? (
                    <Image src={avatar} alt="" width={72} height={72} className="object-cover rounded" />
                ) : (
                    <span className="text-lg font-bold text-foreground font-tiktok">
                        {name.substring(0, 2).toUpperCase()}
                    </span>
                )}
            </div>
            <div className="text-sm font-bold text-foreground mt-2 font-tiktok">[{name}]</div>
        </div>
    )
}

// Calculate round height
function calculateRoundHeight(matchCount: number, gap: number, compact: boolean): number {
    const matchHeight = compact ? MATCH_HEIGHT_COMPACT : MATCH_HEIGHT
    return matchCount * matchHeight + Math.max(0, matchCount - 1) * gap
}

// Bracket Section Component
function BracketSection({ 
    title, 
    rounds, 
    isLower = false,
    compact = false
}: { 
    title: string
    rounds: { round: number; matches: Match[]; name: string }[]
    isLower?: boolean
    compact?: boolean
}) {
    if (rounds.length === 0) return null

    const matchHeight = compact ? MATCH_HEIGHT_COMPACT : MATCH_HEIGHT
    const connectorWidth = compact ? CONNECTOR_WIDTH_COMPACT : CONNECTOR_WIDTH
    const baseGap = compact ? BASE_GAP_COMPACT : BASE_GAP
    const stride = matchHeight + baseGap

    // Compute the correct gap for each round based on effective depth.
    // Depth increments each time the match count halves (merging rounds).
    // Non-halving rounds (e.g., losers bracket) keep the same gap as previous.
    const roundGaps: number[] = []
    const roundIsMerging: boolean[] = []
    let depth = 0
    for (let i = 0; i < rounds.length; i++) {
        if (i > 0 && rounds[i].matches.length < rounds[i - 1].matches.length) {
            depth++
        }
        roundGaps.push(Math.pow(2, depth) * stride - matchHeight)
        const isMerging = i < rounds.length - 1 && rounds[i + 1].matches.length < rounds[i].matches.length
        roundIsMerging.push(isMerging)
    }

    // First round determines the base height
    const firstRoundCount = rounds[0]?.matches.length || 1
    const baseHeight = calculateRoundHeight(firstRoundCount, roundGaps[0], compact)

    return (
        <div className="mb-6">
            {/* Section Title */}
            <div className="mb-3 flex items-center gap-2">
                <h3 className={`text-xs font-bold uppercase tracking-[0.18em] font-tiktok ${isLower ? 'text-red-500/85' : 'text-foreground'}`}>
                    {title}
                </h3>
                <div className={`h-px flex-1 ${isLower ? 'bg-red-400/20' : 'bg-foreground/20'}`} />
            </div>

            <div className="mobile-hide-scrollbar overflow-x-auto overscroll-x-contain pb-3">
                <div 
                    className="mx-auto flex w-max min-w-full items-start justify-center px-1 sm:px-2"
                    style={{ minHeight: baseHeight + 56 }}
                >
                    {rounds.map((roundData, roundIndex) => {
                        const matchCount = roundData.matches.length
                        const gap = roundGaps[roundIndex]
                        const roundHeight = calculateRoundHeight(matchCount, gap, compact)
                        const verticalOffset = (baseHeight - roundHeight) / 2

                        return (
                            <div 
                                key={`${roundData.round}-${roundIndex}`} 
                                className="flex-shrink-0 flex flex-col"
                                style={{ 
                                    marginRight: roundIndex === rounds.length - 1 ? 0 : connectorWidth,
                                    paddingTop: verticalOffset
                                }}
                            >
                                {/* Round name */}
                                <div className="h-7 flex items-center justify-center mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isLower ? 'text-red-400/70' : 'text-[var(--qc-text-muted)]'}`}>
                                        {roundData.name}
                                    </span>
                                </div>

                                {/* Matches */}
                                <div 
                                    className="flex flex-col"
                                    style={{ gap }}
                                >
                                    {roundData.matches.map((match, matchIndex) => (
                                        <MatchCard 
                                            key={match.id} 
                                            match={match} 
                                            compact={compact}
                                            matchIndex={matchIndex}
                                            totalMatchesInRound={matchCount}
                                            isLastRound={roundIndex === rounds.length - 1}
                                            isLower={isLower}
                                            actualGap={gap}
                                            isMerging={roundIsMerging[roundIndex]}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export function EliminationBracket({ tournamentId }: EliminationBracketProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['tournament', tournamentId, 'bracket'],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/matches`)
            if (!res.ok) throw new Error('Error al cargar bracket')
            return res.json()
        },
        refetchOnMount: 'always',
        staleTime: 0,
        refetchOnWindowFocus: true
    })

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="h-4 w-4 mx-auto animate-spin rounded-full border-2 border-foreground/20 border-t-[#1a1a1e]" />
                <div className="text-foreground/40 mt-2 text-sm">Cargando bracket...</div>
            </div>
        )
    }

    if (error || !data?.matches || data.matches.length === 0) {
        return (
            <div className="p-8 text-center">
                <p className="text-foreground/40">El bracket aún no ha sido generado</p>
                <p className="text-foreground/30 text-sm mt-1">
                    Los administradores generarán el bracket cuando las inscripciones cierren
                </p>
            </div>
        )
    }

    const matches: Match[] = data.matches

    // Separate by bracket type
    const upperMatches = matches.filter(m => m.bracket === 'UPPER' && m.roundText !== 'GRAND FINAL')
    const lowerMatches = matches.filter(m => m.bracket === 'LOWER')
    const grandFinal = matches.find(m => m.roundText === 'GRAND FINAL')

    const isDoubleElimination = lowerMatches.length > 0

    // Group by round
    const groupByRound = (matchList: Match[]) => {
        const roundsMap = new Map<number, Match[]>()
        matchList.forEach(m => {
            if (!roundsMap.has(m.round)) roundsMap.set(m.round, [])
            roundsMap.get(m.round)!.push(m)
        })
        return Array.from(roundsMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([round, roundMatches]) => ({
                round,
                matches: roundMatches.sort((a, b) => a.matchNumber - b.matchNumber),
                name: roundMatches[0]?.roundText || `R${round}`
            }))
    }

    const upperRounds = groupByRound(upperMatches)
    const lowerRounds = groupByRound(lowerMatches)

    // Find champion - check multiple possible final match conditions
    const finalMatch = grandFinal || 
        upperMatches.find(m => m.roundText?.toUpperCase().includes('FINAL')) ||
        upperMatches.find(m => m.roundText?.toUpperCase().includes('GRAN FINAL')) ||
        // If no explicit final, the last round's match is the final
        (upperRounds.length > 0 ? upperRounds[upperRounds.length - 1]?.matches[0] : null)
    
    // Determine champion from the winner of the final match
    let champion: Match['participant1Reg'] | null = null
    if (finalMatch?.status === 'COMPLETED') {
        // First try to use the winner relation directly (most reliable)
        if (finalMatch.winner) {
            champion = finalMatch.winner
        } else if (finalMatch.winnerId) {
            // Fallback: Match winnerId with registration ID
            if (finalMatch.winnerId === finalMatch.participant1Reg?.id) {
                champion = finalMatch.participant1Reg
            } else if (finalMatch.winnerId === finalMatch.participant2Reg?.id) {
                champion = finalMatch.participant2Reg
            } else {
                // Last resort: use score to determine winner
                if ((finalMatch.score1 ?? 0) > (finalMatch.score2 ?? 0)) {
                    champion = finalMatch.participant1Reg
                } else if ((finalMatch.score2 ?? 0) > (finalMatch.score1 ?? 0)) {
                    champion = finalMatch.participant2Reg
                }
            }
        }
    }

    return (
        <div className="p-4 sm:p-5">
            {/* Mobile scroll hint */}
            <p className="md:hidden text-[11px] text-foreground/30 text-center mb-3">
                ← Desliza para ver el bracket completo →
            </p>
            {/* Upper Bracket / Main Bracket */}
            <BracketSection 
                title={isDoubleElimination ? "Winners Bracket" : "Bracket"}
                rounds={upperRounds}
            />

            {/* Lower Bracket (Double Elimination only) */}
            {isDoubleElimination && lowerRounds.length > 0 && (
                <BracketSection 
                    title="Losers Bracket"
                    rounds={lowerRounds}
                    isLower={true}
                    compact={true}
                />
            )}

            {/* Grand Final + Champion */}
            <div className="mt-6 pt-5 border-t border-foreground/20">
                <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-[0.18em] font-tiktok">
                        {grandFinal ? 'Grand Final' : 'Final'}
                    </h3>
                    <div className="h-px flex-1 bg-foreground/20" />
                </div>
                
                <div className="flex items-center gap-8">
                    {grandFinal ? (
                        <MatchCard match={grandFinal} isLastRound={true} />
                    ) : finalMatch ? (
                        <MatchCard match={finalMatch} isLastRound={true} />
                    ) : null}
                    <ChampionCard winner={champion} />
                </div>
            </div>
        </div>
    )
}
