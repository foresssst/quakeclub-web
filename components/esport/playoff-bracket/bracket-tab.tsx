"use client"

import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"

interface BracketTabProps {
    tournamentId: string
}

interface Match {
    id: string
    status: string
    score1?: number
    score2?: number
    winnerId?: string
    round?: number
    roundText?: string
    bracket?: string
    bracketPosition?: number
    participant1Reg?: {
        id: string
        clan?: { tag: string; name: string; slug?: string; avatarUrl?: string }
    }
    participant2Reg?: {
        id: string
        clan?: { tag: string; name: string; slug?: string; avatarUrl?: string }
    }
    winner?: {
        id: string
        clan?: { tag: string; name: string; slug?: string; avatarUrl?: string }
    }
}

// Constants for bracket dimensions
const MATCH_HEIGHT = 64 // Height of a single match box
const MATCH_WIDTH = 180 // Width of a match box
const CONNECTOR_WIDTH = 50 // Width of the connector area (increased for better visibility)
const BASE_GAP = 16 // Base gap between matches in first round

// Componente de partido estilo QuakeClub, plano y legible en ambos temas
function BracketMatch({
    match,
    matchIndex,
    totalMatchesInRound,
    isLastRound,
    actualGap = 0,
    isMerging = false
}: {
    match: Match | null
    matchIndex: number
    totalMatchesInRound: number
    isLastRound: boolean
    actualGap?: number
    isMerging?: boolean
}) {
    const team1 = match?.participant1Reg
    const team2 = match?.participant2Reg
    const isCompleted = match?.status === 'COMPLETED'
    
    // Determinar ganador usando scores como fuente principal
    const score1 = match?.score1 ?? 0
    const score2 = match?.score2 ?? 0
    let team1Won = false
    let team2Won = false
    
    if (isCompleted) {
        if (score1 > score2) {
            team1Won = true
        } else if (score2 > score1) {
            team2Won = true
        } else if (match?.winnerId) {
            team1Won = match.winnerId === team1?.id
            team2Won = match.winnerId === team2?.id
        }
    }

    // Mostrar conector para partidos que alimentan la siguiente ronda
    const showConnector = !isLastRound && isMerging
    const isTopOfPair = matchIndex % 2 === 0

    // Show straight connector for non-merging rounds
    const showStraightConnector = !isLastRound && !isMerging

    // Calcular dimensiones del conector
    const halfMatchHeight = MATCH_HEIGHT / 2
    const connectorVerticalSpan = halfMatchHeight + actualGap / 2

    return (
        <div className="relative flex items-center group/match">
            <div 
                className="relative rounded-lg overflow-hidden border border-foreground/[0.06] bg-card shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all duration-200 group-hover/match:border-foreground/[0.10]"
                style={{ width: MATCH_WIDTH, height: MATCH_HEIGHT }}
            >
                {/* Team 1 */}
                <div 
                    className={`relative flex items-center h-1/2 transition-all duration-200 ${
                        team1Won 
                            ? 'bg-foreground/[0.08]' 
                            : 'hover:bg-foreground/[0.03]'
                    }`}
                >
                    {/* Indicador de ganador */}
                    {team1Won && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-foreground/75" />
                    )}
                    
                    {team1?.clan?.slug ? (
                        <Link href={`/clanes/${team1.clan.slug}`} className="flex items-center gap-2 px-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            {team1?.clan?.avatarUrl ? (
                                <div className="relative w-5 h-5 flex-shrink-0 overflow-hidden rounded">
                                    <Image
                                        src={team1.clan.avatarUrl}
                                        alt=""
                                        fill
                                        className={`object-cover ring-1 ${team1Won ? 'ring-foreground/[0.20]' : 'ring-foreground/[0.10]'}`}
                                    />
                                </div>
                            ) : (
                                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold ${
                                    team1Won ? 'bg-foreground/[0.10] text-foreground' : 'bg-foreground/[0.05] text-foreground/45'
                                }`}>
                                    {team1?.clan?.tag?.substring(0, 2) || '?'}
                                </div>
                            )}
                            <span className={`text-xs font-semibold truncate tracking-wide ${
                                team1Won ? 'text-foreground' : 'text-foreground/80'
                            }`}>
                                {team1?.clan?.tag || 'TBD'}
                            </span>
                        </Link>
                    ) : (
                        <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                            {team1?.clan?.avatarUrl ? (
                                <div className="relative w-5 h-5 flex-shrink-0 overflow-hidden rounded">
                                    <Image
                                        src={team1.clan.avatarUrl}
                                        alt=""
                                        fill
                                        className={`object-cover ring-1 ${team1Won ? 'ring-foreground/[0.20]' : 'ring-foreground/[0.10]'}`}
                                    />
                                </div>
                            ) : (
                                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold ${
                                    team1Won ? 'bg-foreground/[0.10] text-foreground' : 'bg-foreground/[0.05] text-foreground/45'
                                }`}>
                                    {team1?.clan?.tag?.substring(0, 2) || '?'}
                                </div>
                            )}
                            <span className={`text-xs font-semibold truncate tracking-wide ${
                                team1Won ? 'text-foreground' : 'text-foreground/80'
                            }`}>
                                {team1?.clan?.tag || 'TBD'}
                            </span>
                        </div>
                    )}
                    <div 
                        className={`w-9 h-full flex items-center justify-center text-sm font-bold transition-all ${
                            team1Won 
                                ? 'bg-foreground text-background' 
                                : 'bg-foreground/[0.04] text-foreground/50'
                        }`}
                    >
                        {isCompleted ? (match?.score1 ?? 0) : '-'}
                    </div>
                </div>

                {/* Separador central */}
                <div className="absolute left-0 right-0 top-1/2 h-px bg-foreground/[0.06]" />

                {/* Team 2 */}
                <div 
                    className={`relative flex items-center h-1/2 transition-all duration-200 ${
                        team2Won 
                            ? 'bg-foreground/[0.08]' 
                            : 'hover:bg-foreground/[0.03]'
                    }`}
                >
                    {/* Indicador de ganador */}
                    {team2Won && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-foreground/75" />
                    )}
                    
                    {team2?.clan?.slug ? (
                        <Link href={`/clanes/${team2.clan.slug}`} className="flex items-center gap-2 px-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            {team2?.clan?.avatarUrl ? (
                                <div className="relative w-5 h-5 flex-shrink-0 overflow-hidden rounded">
                                    <Image
                                        src={team2.clan.avatarUrl}
                                        alt=""
                                        fill
                                        className={`object-cover ring-1 ${team2Won ? 'ring-foreground/[0.20]' : 'ring-foreground/[0.10]'}`}
                                    />
                                </div>
                            ) : (
                                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold ${
                                    team2Won ? 'bg-foreground/[0.10] text-foreground' : 'bg-foreground/[0.05] text-foreground/45'
                                }`}>
                                    {team2?.clan?.tag?.substring(0, 2) || '?'}
                                </div>
                            )}
                            <span className={`text-xs font-semibold truncate tracking-wide ${
                                team2Won ? 'text-foreground' : 'text-foreground/80'
                            }`}>
                                {team2?.clan?.tag || 'TBD'}
                            </span>
                        </Link>
                    ) : (
                        <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
                            {team2?.clan?.avatarUrl ? (
                                <div className="relative w-5 h-5 flex-shrink-0 overflow-hidden rounded">
                                    <Image
                                        src={team2.clan.avatarUrl}
                                        alt=""
                                        fill
                                        className={`object-cover ring-1 ${team2Won ? 'ring-foreground/[0.20]' : 'ring-foreground/[0.10]'}`}
                                    />
                                </div>
                            ) : (
                                <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold ${
                                    team2Won ? 'bg-foreground/[0.10] text-foreground' : 'bg-foreground/[0.05] text-foreground/45'
                                }`}>
                                    {team2?.clan?.tag?.substring(0, 2) || '?'}
                                </div>
                            )}
                            <span className={`text-xs font-semibold truncate tracking-wide ${
                                team2Won ? 'text-foreground' : 'text-foreground/80'
                            }`}>
                                {team2?.clan?.tag || 'TBD'}
                            </span>
                        </div>
                    )}
                    <div
                        className={`w-9 h-full flex items-center justify-center text-sm font-bold transition-all ${
                            team2Won
                                ? 'bg-foreground text-background'
                                : 'bg-foreground/[0.04] text-foreground/50'
                        }`}
                    >
                        {isCompleted ? (match?.score2 ?? 0) : '-'}
                    </div>
                </div>
            </div>

            {showConnector && isTopOfPair && (
                <div 
                    className="absolute pointer-events-none"
                    style={{ 
                        left: MATCH_WIDTH,
                        top: '50%',
                        width: CONNECTOR_WIDTH,
                        height: connectorVerticalSpan * 2
                    }}
                >
                    {/* Línea vertical con esquina */}
                    <div 
                        className="absolute rounded-tr-sm"
                        style={{
                            left: 0,
                            top: 0,
                            width: CONNECTOR_WIDTH / 2,
                            height: connectorVerticalSpan,
                            borderTop: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                            opacity: 0.85,
                        }}
                    />
                    {/* Línea horizontal */}
                    <div 
                        className="absolute"
                        style={{
                            left: CONNECTOR_WIDTH / 2,
                            top: connectorVerticalSpan,
                            width: CONNECTOR_WIDTH / 2,
                            height: 1,
                            background: 'var(--border)',
                            opacity: 0.85,
                        }}
                    />
                </div>
            )}

            {/* Conector inferior */}
            {showConnector && !isTopOfPair && (
                <div 
                    className="absolute pointer-events-none"
                    style={{ 
                        left: MATCH_WIDTH,
                        bottom: '50%',
                        width: CONNECTOR_WIDTH,
                        height: connectorVerticalSpan * 2
                    }}
                >
                    {/* Línea vertical con esquina */}
                    <div 
                        className="absolute rounded-br-sm"
                        style={{
                            left: 0,
                            bottom: 0,
                            width: CONNECTOR_WIDTH / 2,
                            height: connectorVerticalSpan,
                            borderBottom: '1px solid var(--border)',
                            borderRight: '1px solid var(--border)',
                            opacity: 0.85,
                        }}
                    />
                    {/* Línea horizontal */}
                    <div 
                        className="absolute"
                        style={{
                            left: CONNECTOR_WIDTH / 2,
                            bottom: connectorVerticalSpan,
                            width: CONNECTOR_WIDTH / 2,
                            height: 1,
                            background: 'var(--border)',
                            opacity: 0.85,
                        }}
                    />
                </div>
            )}

            {/* Straight connector for non-merging rounds */}
            {showStraightConnector && (
                <div 
                    className="absolute pointer-events-none"
                    style={{ 
                        left: MATCH_WIDTH,
                        top: '50%',
                        width: CONNECTOR_WIDTH,
                        height: 1,
                        marginTop: 0,
                        background: 'var(--border)',
                        opacity: 0.85,
                    }}
                />
            )}
        </div>
    )
}

export function BracketTab({ tournamentId }: BracketTabProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['tournament', tournamentId, 'playoffs'],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/playoffs`)
            if (!res.ok) throw new Error('Error al cargar playoffs')
            return res.json()
        },
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true
    })

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="text-foreground/40">Cargando playoffs...</div>
            </div>
        )
    }

    if (error || !data?.matches || data.matches.length === 0) {
        return (
            <div className="p-12 text-center">
                <p className="text-foreground/40">Los playoffs aún no han comenzado</p>
                <p className="text-foreground/30 text-sm mt-1">
                    Se generarán al finalizar la fase de grupos
                </p>
            </div>
        )
    }

    const matches: Match[] = data.matches
    
    // Separate playoff matches from third place
    const playoffMatches = matches.filter(m => m.bracket !== 'LOWER')
    const thirdPlace = matches.find(m => m.bracket === 'LOWER')
    
    // Group matches by round number
    const matchesByRound: Record<number, Match[]> = {}
    playoffMatches.forEach(m => {
        const round = m.round || 0
        if (!matchesByRound[round]) matchesByRound[round] = []
        matchesByRound[round].push(m)
    })

    // Sort matches within each round by their position/matchNumber
    // Use bracketPosition first, then fall back to ordering by ID or match number
    Object.values(matchesByRound).forEach(roundMatches => {
        roundMatches.sort((a, b) => {
            // First try bracketPosition
            const posA = a.bracketPosition ?? Infinity
            const posB = b.bracketPosition ?? Infinity
            if (posA !== posB) return posA - posB
            // Then try to order by some other criteria if available
            return a.id.localeCompare(b.id)
        })
    })

    // Build rounds array in order
    const roundNumbers = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b)
    const rounds: Match[][] = roundNumbers.map(r => matchesByRound[r])

    // Get round name
    const getRoundName = (roundIdx: number, totalRounds: number, match?: Match): string => {
        if (match?.roundText) return match.roundText
        if (roundIdx === totalRounds - 1) return 'Final'
        if (roundIdx === totalRounds - 2) return 'Semifinal'
        if (roundIdx === totalRounds - 3) return 'Cuartos'
        return `Ronda ${roundIdx + 1}`
    }

    // Calculate the total height needed for proper alignment
    const calculateRoundHeight = (matchCount: number, gap: number): number => {
        return matchCount * MATCH_HEIGHT + Math.max(0, matchCount - 1) * gap
    }

    const stride = MATCH_HEIGHT + BASE_GAP

    // Compute correct gaps for each round based on effective depth
    const roundGaps: number[] = []
    const roundIsMerging: boolean[] = []
    let depth = 0
    for (let i = 0; i < rounds.length; i++) {
        if (i > 0 && rounds[i].length < rounds[i - 1].length) {
            depth++
        }
        roundGaps.push(Math.pow(2, depth) * stride - MATCH_HEIGHT)
        const isMerging = i < rounds.length - 1 && rounds[i + 1].length < rounds[i].length
        roundIsMerging.push(isMerging)
    }

    // First round determines the base height
    const firstRoundMatches = rounds[0]?.length || 1
    const baseHeight = calculateRoundHeight(firstRoundMatches, roundGaps[0])

    // Get champion - find the FINAL match (NOT semifinal)
    const finalMatch = playoffMatches.find(m => {
        const rt = m.roundText?.toUpperCase() || ''
        // Must be exactly "FINAL" or contain "GRAN FINAL", but NOT "SEMIFINAL"
        return (rt === 'FINAL' || rt.includes('GRAN FINAL')) && !rt.includes('SEMI')
    }) || (rounds.length > 0 ? rounds[rounds.length - 1]?.[0] : null)
    
    // Determine champion - ONLY when final is COMPLETED
    let champion: Match['participant1Reg'] | null = null
    if (finalMatch?.status === 'COMPLETED') {
        const score1 = finalMatch.score1 ?? 0
        const score2 = finalMatch.score2 ?? 0
        
        // Primary method: Use scores to determine winner (most reliable)
        if (score1 > score2) {
            champion = finalMatch.participant1Reg ?? null
        } else if (score2 > score1) {
            champion = finalMatch.participant2Reg ?? null
        } else {
            // Scores are tied, try winnerId
            if (finalMatch.winnerId) {
                if (finalMatch.winnerId === finalMatch.participant1Reg?.id) {
                    champion = finalMatch.participant1Reg
                } else if (finalMatch.winnerId === finalMatch.participant2Reg?.id) {
                    champion = finalMatch.participant2Reg
                } else if (finalMatch.winner) {
                    // Use winner relation as last resort
                    champion = finalMatch.winner
                }
            } else if (finalMatch.winner) {
                champion = finalMatch.winner
            }
        }
    }

    return (
        <div className="p-3 sm:p-4 md:p-6">
            {/* Mobile scroll hint */}
            <p className="md:hidden text-[10px] text-foreground/30 text-center mb-2">
                ← Desliza para ver el bracket completo →
            </p>
            {/* Bracket Container */}
            <div className="overflow-x-auto pb-4 -mx-3 sm:-mx-4 md:mx-0 px-3 sm:px-4 md:px-0">
                <div 
                    className="inline-flex items-start pt-4 pb-4 px-4 min-w-max"
                    style={{ minHeight: baseHeight + 80 }}
                >
                    {rounds.map((roundMatches, roundIndex) => {
                        const matchCount = roundMatches.length
                        const gap = roundGaps[roundIndex]
                        const roundHeight = calculateRoundHeight(matchCount, gap)
                        // Center this round vertically relative to the first round
                        const verticalOffset = (baseHeight - roundHeight) / 2

                        return (
                            <div 
                                key={roundIndex} 
                                className="flex flex-col flex-shrink-0"
                                style={{ 
                                    marginRight: CONNECTOR_WIDTH,
                                    paddingTop: verticalOffset
                                }}
                            >
                                {/* Round Header */}
                                <div className="text-center mb-3" style={{ height: 20 }}>
                                    <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-wider">
                                        {getRoundName(roundIndex, rounds.length, roundMatches[0])}
                                    </span>
                                </div>

                                {/* Matches */}
                                <div 
                                    className="flex flex-col"
                                    style={{ gap }}
                                >
                                    {roundMatches.map((match, matchIndex) => (
                                        <BracketMatch
                                            key={match.id}
                                            match={match}
                                            matchIndex={matchIndex}
                                            totalMatchesInRound={matchCount}
                                            isLastRound={roundIndex === rounds.length - 1}
                                            actualGap={gap}
                                            isMerging={roundIsMerging[roundIndex]}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    })}

                    {/* Champion Display */}
                    <div 
                        className="flex flex-col justify-center ml-6 flex-shrink-0"
                        style={{ paddingTop: (baseHeight - 140) / 2 }}
                    >
                        <div className="text-center">
                            <div className="text-[10px] font-bold text-[var(--qc-text-muted)] uppercase tracking-widest mb-4">
                                Campeón
                            </div>
                            {champion ? (
                                <div className="relative">
                                    <div className="relative bg-card border border-foreground/[0.08] rounded-lg p-5 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
                                        <div className="relative w-20 h-20 mx-auto mb-3">
                                            <div className="absolute inset-0 rounded-lg border border-foreground/[0.08] bg-[var(--qc-bg-pure)] p-0.5">
                                                <div className="w-full h-full bg-[var(--qc-bg-pure)] rounded-lg flex items-center justify-center overflow-hidden">
                                                    {champion.clan?.avatarUrl ? (
                                                        <Image
                                                            src={champion.clan.avatarUrl}
                                                            alt=""
                                                            width={72}
                                                            height={72}
                                                            className="rounded object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-2xl font-bold text-foreground">
                                                            {champion.clan?.tag?.substring(0, 2)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Tag del clan */}
                                        <div className="text-base font-bold text-foreground font-tiktok tracking-wide">
                                            [{champion.clan?.tag}]
                                        </div>
                                        <div className="text-xs text-foreground/50 mt-1 max-w-[100px] truncate mx-auto">
                                            {champion.clan?.name}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="bg-foreground/[0.03] border border-foreground/[0.06] border-dashed rounded-lg p-5">
                                        <div className="w-20 h-20 mx-auto mb-3 bg-foreground/[0.03] border border-dashed border-foreground/[0.10] rounded-lg flex items-center justify-center">
                                            <span className="text-3xl text-foreground/20">?</span>
                                        </div>
                                        <div className="text-xs text-foreground/30">Por definir</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Third Place Match - Diseño mejorado */}
            {thirdPlace && (
                <div className="mt-8 pt-6 border-t border-foreground/[0.06]">
                    <div className="text-center mb-5">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-foreground/[0.05] border border-foreground/[0.06] rounded-full">
                            <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">
                                Partido por el 3° Puesto
                            </span>
                        </span>
                    </div>
                    <div className="flex justify-center">
                        <BracketMatch
                            match={thirdPlace}
                            matchIndex={0}
                            totalMatchesInRound={1}
                            isLastRound={true}
                        />
                    </div>
                </div>
            )}

            {/* Legend - Diseño mejorado */}
            <div className="mt-8 pt-5 border-t border-foreground/[0.06] text-center">
                <p className="text-[10px] text-[var(--qc-text-muted)] uppercase tracking-widest">
                    Los clasificados de cada grupo se enfrentan en playoffs cruzados
                </p>
            </div>
        </div>
    )
}
