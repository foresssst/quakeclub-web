"use client"

import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"

interface CalendarTabProps {
    tournamentId: string
}

interface MapResult {
    mapName: string
    score1: number
    score2: number
}

interface Match {
    id: string
    status: string
    score1?: number
    score2?: number
    scheduledAt?: string
    isPlayoff?: boolean
    round?: string
    group?: {
        name: string
    }
    participant1Reg?: {
        clan?: { tag: string; name: string; slug?: string; avatarUrl?: string }
        tournamentTeam?: { tag: string; name: string; avatarUrl?: string }
        player?: { username: string }
    }
    participant2Reg?: {
        clan?: { tag: string; name: string; slug?: string; avatarUrl?: string }
        tournamentTeam?: { tag: string; name: string; avatarUrl?: string }
        player?: { username: string }
    }
    maps?: MapResult[]
}

interface Matchday {
    id: string
    name: string
    date?: string
    matches: Match[]
}

export function CalendarTab({ tournamentId }: CalendarTabProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['tournament', tournamentId, 'calendar'],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/calendar`)
            if (!res.ok) throw new Error('Error al cargar calendario')
            return res.json()
        }
    })

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="text-foreground/40">Cargando calendario...</div>
            </div>
        )
    }

    if (error || !data?.matchdays || data.matchdays.length === 0) {
        return (
            <div className="p-12 text-center">
                <p className="text-foreground/40">No hay partidos programados</p>
            </div>
        )
    }

    const matchdays: Matchday[] = data.matchdays

    return (
        <div className="p-6 space-y-6">
            {matchdays.map((matchday) => (
                <div key={matchday.id} className="space-y-2">
                    {/* Matchday Header */}
                    <div className="flex items-center gap-3 pb-2 border-b border-foreground/[0.06]">
                        <h3 className="text-sm font-bold text-foreground font-tiktok uppercase tracking-wider">
                            {matchday.name}
                        </h3>
                        <div className="h-1 w-8 bg-foreground rounded-full opacity-50" />
                        {matchday.date && (
                            <span className="text-xs text-foreground/40">
                                {new Date(matchday.date).toLocaleDateString('es-ES', { 
                                    weekday: 'long', 
                                    day: 'numeric', 
                                    month: 'long' 
                                })}
                            </span>
                        )}
                    </div>

                    {/* Matches */}
                    <div className="space-y-1">
                        {matchday.matches.map((match) => {
                            const team1 = match.participant1Reg
                            const team2 = match.participant2Reg
                            const isCompleted = match.status === 'COMPLETED'
                            const maps = match.maps || []

                            const t1Info = team1?.tournamentTeam || team1?.clan
                            const t2Info = team2?.tournamentTeam || team2?.clan
                            const t1Tag = t1Info?.tag || team1?.player?.username || 'TBD'
                            const t1Name = t1Info?.name || team1?.player?.username || ''
                            const t1Avatar = t1Info?.avatarUrl
                            const t1Link = team1?.clan?.slug ? `/clanes/${team1.clan.slug}` : null
                            const t2Tag = t2Info?.tag || team2?.player?.username || 'TBD'
                            const t2Name = t2Info?.name || team2?.player?.username || ''
                            const t2Avatar = t2Info?.avatarUrl
                            const t2Link = team2?.clan?.slug ? `/clanes/${team2.clan.slug}` : null

                            const renderTeam1 = (
                                <>
                                    {t1Avatar ? (
                                        <Image src={t1Avatar} alt={t1Name} width={32} height={32} className="rounded-lg" />
                                    ) : (
                                        <div className="w-8 h-8 bg-black/10 rounded-lg" />
                                    )}
                                    <div>
                                        <span className="text-sm font-bold text-foreground block">[{t1Tag}]</span>
                                        <span className="text-xs text-foreground/40 hidden sm:block">{t1Name}</span>
                                    </div>
                                </>
                            )

                            const renderTeam2 = (
                                <>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-foreground block">[{t2Tag}]</span>
                                        <span className="text-xs text-foreground/40 hidden sm:block">{t2Name}</span>
                                    </div>
                                    {t2Avatar ? (
                                        <Image src={t2Avatar} alt={t2Name} width={32} height={32} className="rounded-lg" />
                                    ) : (
                                        <div className="w-8 h-8 bg-black/10 rounded-lg" />
                                    )}
                                </>
                            )

                            return (
                                <div
                                    key={match.id}
                                    className="bg-black/5 hover:bg-black/10 border border-transparent hover:border-foreground/[0.06] transition-all"
                                >
                                    {/* Match */}
                                    <div className="p-4">
                                        <div className="flex items-center justify-between">
                                            {/* Team 1 */}
                                            {t1Link ? (
                                                <Link href={t1Link} className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity">
                                                    {renderTeam1}
                                                </Link>
                                            ) : (
                                                <div className="flex items-center gap-3 flex-1">
                                                    {renderTeam1}
                                                </div>
                                            )}

                                            {/* Score */}
                                            <div className="flex items-center gap-3 px-6">
                                                <span className={`text-2xl font-bold ${
                                                    isCompleted && (match.score1 || 0) > (match.score2 || 0)
                                                        ? 'text-foreground'
                                                        : 'text-foreground/40'
                                                }`}>
                                                    {isCompleted ? (match.score1 ?? 0) : '-'}
                                                </span>
                                                <span className="text-foreground/20 text-lg">:</span>
                                                <span className={`text-2xl font-bold ${
                                                    isCompleted && (match.score2 || 0) > (match.score1 || 0)
                                                        ? 'text-foreground'
                                                        : 'text-foreground/40'
                                                }`}>
                                                    {isCompleted ? (match.score2 ?? 0) : '-'}
                                                </span>
                                            </div>

                                            {/* Team 2 */}
                                            {t2Link ? (
                                                <Link href={t2Link} className="flex items-center gap-3 flex-1 justify-end hover:opacity-80 transition-opacity">
                                                    {renderTeam2}
                                                </Link>
                                            ) : (
                                                <div className="flex items-center gap-3 flex-1 justify-end">
                                                    {renderTeam2}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status */}
                                        <div className="flex items-center justify-center gap-2 mt-3">
                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                isCompleted 
                                                    ? 'bg-foreground/20 text-foreground'
                                                    : 'bg-black/10 text-foreground/40'
                                            }`}>
                                                {isCompleted ? 'Finalizado' : 'Por Jugar'}
                                            </span>
                                            {match.group && (
                                                <span className="text-xs text-foreground/30">
                                                    {match.group.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Map Results */}
                                    {isCompleted && maps.length > 0 && (
                                        <div className="border-t border-foreground/[0.06] bg-[var(--qc-bg-pure)]/30">
                                            <div className="flex flex-wrap justify-center gap-3 px-4 py-3">
                                                {maps.map((map, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-2 px-2 py-1 bg-black/5"
                                                    >
                                                        <span className="text-[10px] text-foreground/40 uppercase">{map.mapName}</span>
                                                        <span className={`text-xs font-bold ${map.score1 > map.score2 ? 'text-foreground' : 'text-foreground/40'}`}>
                                                            {map.score1}
                                                        </span>
                                                        <span className="text-foreground/20">-</span>
                                                        <span className={`text-xs font-bold ${map.score2 > map.score1 ? 'text-foreground' : 'text-foreground/40'}`}>
                                                            {map.score2}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
