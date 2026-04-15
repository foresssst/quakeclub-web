"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"
import { use } from "react"
import Image from "next/image"

interface MapResult {
    id: string
    mapName: string
    score1: number
    score2: number
    winnerId?: string
    status: string
}

interface Match {
    id: string
    status: string
    score1?: number
    score2?: number
    winnerId?: string
    isPlayoff?: boolean
    round?: number
    roundText?: string
    bracket?: 'UPPER' | 'LOWER'
    group?: {
        id: string
        name: string
    }
    participant1Reg?: {
        id: string
        clan?: { tag: string; name: string; avatarUrl?: string }
        tournamentTeam?: { tag: string; name: string; avatarUrl?: string }
        player?: { username: string; avatarUrl?: string }
    }
    participant2Reg?: {
        id: string
        clan?: { tag: string; name: string; avatarUrl?: string }
        tournamentTeam?: { tag: string; name: string; avatarUrl?: string }
        player?: { username: string; avatarUrl?: string }
    }
    maps?: MapResult[]
}

export default function RegistroResultadosPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const queryClient = useQueryClient()
    const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
    const [resultForm, setResultForm] = useState<Record<string, { score1: string; score2: string }>>({})

    const { data: authData } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const res = await fetch("/api/auth/me")
            if (!res.ok) {
                router.push("/login")
                throw new Error("Not authenticated")
            }
            const data = await res.json()
            if (!data.user.isAdmin) {
                router.push("/")
                throw new Error("Not admin")
            }
            return data
        }
    })

    const { data: tournament, isLoading } = useQuery({
        queryKey: ['tournament', id],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${id}`)
            if (!res.ok) throw new Error('Error')
            const data = await res.json()
            return data.tournament || data
        },
        enabled: !!authData?.user?.isAdmin,
        refetchOnMount: 'always',
        staleTime: 0,
        refetchOnWindowFocus: true
    })

    // Simplified: Set result directly
    const setResultMutation = useMutation({
        mutationFn: async ({ matchId, score1, score2 }: { matchId: string; score1: number; score2: number }) => {
            const res = await fetch(`/api/admin/tournaments/${id}/matches/${matchId}/result`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score1, score2 })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al registrar resultado')
            }
            return res.json()
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            setResultForm(prev => ({ ...prev, [variables.matchId]: { score1: '', score2: '' } }))
            setExpandedMatch(null)
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    if (!authData?.user?.isAdmin) return null
    if (isLoading) {
        return (
            <AdminLayout title="Cargando..." subtitle="">
                <div className="flex items-center justify-center py-16">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-[#1a1a1e]" />
                </div>
            </AdminLayout>
        )
    }

    const matches: Match[] = tournament?.matches || []
    const isEliminationTournament = tournament?.format === 'SINGLE_ELIMINATION' || tournament?.format === 'DOUBLE_ELIMINATION'
    const isCustomTournament = tournament?.tournamentType === 'CUSTOM_GROUP'

    // For elimination tournaments, group by round
    const matchesByRound: Record<string, Match[]> = {}
    if (isEliminationTournament) {
        matches.forEach(match => {
            const roundName = match.roundText || `Ronda ${match.round}`
            if (!matchesByRound[roundName]) {
                matchesByRound[roundName] = []
            }
            matchesByRound[roundName].push(match)
        })
    }

    // For custom tournaments - group by group name
    const groupMatches = matches.filter(m => !m.isPlayoff)
    const playoffMatches = matches.filter(m => m.isPlayoff)

    const matchesByGroup: Record<string, Match[]> = {}
    groupMatches.forEach(match => {
        const groupName = match.group?.name || 'Sin Grupo'
        if (!matchesByGroup[groupName]) {
            matchesByGroup[groupName] = []
        }
        matchesByGroup[groupName].push(match)
    })

    const getResultForm = (matchId: string) => {
        return resultForm[matchId] || { score1: '', score2: '' }
    }

    const updateResultForm = (matchId: string, field: string, value: string) => {
        setResultForm(prev => ({
            ...prev,
            [matchId]: { ...getResultForm(matchId), [field]: value }
        }))
    }

    const handleSetResult = (matchId: string) => {
        const form = getResultForm(matchId)
        if (form.score1 === '' || form.score2 === '') {
            toast.warning('Ingresa ambos scores')
            return
        }
        setResultMutation.mutate({
            matchId,
            score1: parseInt(form.score1),
            score2: parseInt(form.score2)
        })
    }

    const completedCount = matches.filter(m => m.status === 'COMPLETED').length
    const pendingCount = matches.filter(m => m.status !== 'COMPLETED').length

    const renderMatch = (match: Match) => {
        const isExpanded = expandedMatch === match.id
        const team1 = match.participant1Reg
        const team2 = match.participant2Reg
        const isCompleted = match.status === 'COMPLETED'

        const team1Info = team1?.tournamentTeam || team1?.clan
        const team2Info = team2?.tournamentTeam || team2?.clan
        const team1Name = team1Info?.tag || team1?.player?.username || 'TBD'
        const team2Name = team2Info?.tag || team2?.player?.username || 'TBD'
        const team1Avatar = team1Info?.avatarUrl || team1?.player?.avatarUrl
        const team2Avatar = team2Info?.avatarUrl || team2?.player?.avatarUrl

        const canSetResult = team1 && team2 && !isCompleted

        return (
            <div key={match.id} className="bg-card border border-black/5 hover:border-foreground/10 transition-all">
                {/* Match Header */}
                <button
                    onClick={() => canSetResult ? setExpandedMatch(isExpanded ? null : match.id) : null}
                    className={`w-full px-5 py-4 flex items-center justify-between transition-colors ${canSetResult ? 'hover:bg-foreground/[0.02] cursor-pointer' : 'cursor-default'}`}
                >
                    <div className="flex items-center gap-6">
                        {/* Team 1 */}
                        <div className="flex items-center gap-3 min-w-[120px]">
                            {team1Avatar ? (
                                <Image src={team1Avatar} alt="" width={24} height={24} className="rounded-lg border border-foreground/10" />
                            ) : (
                                <div className="w-6 h-6 bg-black/10 rounded-lg" />
                            )}
                            <span className={`text-sm font-semibold ${match.winnerId === team1?.id ? 'text-foreground' : 'text-foreground'}`}>
                                [{team1Name}]
                            </span>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-3 px-4">
                            <span className={`text-lg font-bold ${match.winnerId === team1?.id ? 'text-foreground' : 'text-foreground/40'}`}>
                                {match.score1 ?? 0}
                            </span>
                            <span className="text-foreground/20 text-sm">vs</span>
                            <span className={`text-lg font-bold ${match.winnerId === team2?.id ? 'text-foreground' : 'text-foreground/40'}`}>
                                {match.score2 ?? 0}
                            </span>
                        </div>

                        {/* Team 2 */}
                        <div className="flex items-center gap-3 min-w-[120px]">
                            {team2Avatar ? (
                                <Image src={team2Avatar} alt="" width={24} height={24} className="rounded-lg border border-foreground/10" />
                            ) : (
                                <div className="w-6 h-6 bg-black/10 rounded-lg" />
                            )}
                            <span className={`text-sm font-semibold ${match.winnerId === team2?.id ? 'text-foreground' : 'text-foreground'}`}>
                                [{team2Name}]
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg ${
                            isCompleted
                                ? 'bg-foreground/20 text-foreground border border-foreground/30'
                                : 'bg-black/5 text-foreground/40 border border-foreground/10'
                        }`}>
                            {isCompleted ? 'Finalizado' : 'Pendiente'}
                        </span>
                        {canSetResult && (
                            <span className="text-foreground/30 text-xs">{isExpanded ? '▲' : '▼'}</span>
                        )}
                    </div>
                </button>

                {/* Expanded Content - Simple Result Form */}
                {isExpanded && canSetResult && (
                    <div className="border-t border-black/5 p-6 bg-card">
                        <div className="flex items-center justify-center gap-6">
                            <div className="text-center">
                                <div className="text-xs text-foreground/40 mb-2">[{team1Name}]</div>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={getResultForm(match.id).score1}
                                    onChange={(e) => updateResultForm(match.id, 'score1', e.target.value)}
                                    className="w-20 px-4 py-3 bg-foreground/[0.04] border border-foreground/10 text-xl text-foreground text-center font-bold placeholder-foreground/30 focus:border-foreground/50 focus:outline-none rounded-lg"
                                />
                            </div>
                            <span className="text-foreground/20 text-lg mt-6">vs</span>
                            <div className="text-center">
                                <div className="text-xs text-foreground/40 mb-2">[{team2Name}]</div>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={getResultForm(match.id).score2}
                                    onChange={(e) => updateResultForm(match.id, 'score2', e.target.value)}
                                    className="w-20 px-4 py-3 bg-foreground/[0.04] border border-foreground/10 text-xl text-foreground text-center font-bold placeholder-foreground/30 focus:border-foreground/50 focus:outline-none rounded-lg"
                                />
                            </div>
                            <button
                                onClick={() => handleSetResult(match.id)}
                                disabled={setResultMutation.isPending}
                                className="bg-foreground text-white px-6 py-3 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50 mt-6"
                            >
                                {setResultMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const getFormatLabel = () => {
        if (tournament?.format === 'DOUBLE_ELIMINATION') return 'Double Elimination'
        if (tournament?.format === 'SINGLE_ELIMINATION') return 'Single Elimination'
        return 'Fase de Grupos'
    }

    // Separate playoff matches from third place match
    const mainPlayoffs = isCustomTournament ? playoffMatches.filter(m => m.roundText !== '3° PUESTO') : []
    const thirdPlace = isCustomTournament ? playoffMatches.find(m => m.roundText === '3° PUESTO') : null

    return (
        <AdminLayout title="Registro de Resultados" subtitle={`${tournament?.name} - ${getFormatLabel()}`}>
            <div className="mb-4">
                <Link
                    href={`/admin/esport/${id}`}
                    className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider"
                >
                    ← Volver al Torneo
                </Link>
            </div>

            <div className="space-y-6">
                {/* Stats */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up">
                        <div className="text-3xl font-bold text-foreground font-tiktok">{matches.length}</div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mt-1">Total Partidos</div>
                    </div>
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up" style={{ animationDelay: "50ms" }}>
                        <div className="text-3xl font-bold text-foreground/50 font-tiktok">{pendingCount}</div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mt-1">Pendientes</div>
                    </div>
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up" style={{ animationDelay: "100ms" }}>
                        <div className="text-3xl font-bold text-foreground font-tiktok">{completedCount}</div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mt-1">Completados</div>
                    </div>
                </div>

                {/* Elimination Tournament - Show by Round */}
                {isEliminationTournament && Object.keys(matchesByRound).length > 0 && (
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 animate-fade-up" style={{ animationDelay: "150ms" }}>
                        <div className="flex items-center justify-between border-b border-foreground/10 bg-[var(--qc-bg-pure)] px-6 py-4">
                            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground font-tiktok">
                                Bracket - {tournament?.format === 'DOUBLE_ELIMINATION' ? 'Double Elimination' : 'Single Elimination'}
                            </h2>
                            <div className="h-1 w-8 bg-foreground rounded-full opacity-50" />
                        </div>
                        <div className="p-6 space-y-6">
                            {Object.entries(matchesByRound).map(([roundName, roundMatches]) => (
                                <div key={roundName} className="space-y-3">
                                    <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-wider font-tiktok">{roundName}</h3>
                                    <div className="space-y-2">
                                        {roundMatches.map(renderMatch)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Tournament - Group Matches */}
                {isCustomTournament && Object.keys(matchesByGroup).length > 0 && (
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 animate-fade-up" style={{ animationDelay: "150ms" }}>
                        <div className="flex items-center justify-between border-b border-foreground/10 bg-[var(--qc-bg-pure)] px-6 py-4">
                            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground font-tiktok">
                                Fase de Grupos
                            </h2>
                            <div className="h-1 w-8 bg-foreground rounded-full opacity-50" />
                        </div>
                        <div className="p-6 space-y-6">
                            {Object.entries(matchesByGroup).sort().map(([groupName, groupMatchesList]) => (
                                <div key={groupName} className="space-y-3">
                                    <h3 className="text-xs font-bold text-foreground/50 uppercase tracking-wider font-tiktok">{groupName}</h3>
                                    <div className="space-y-2">
                                        {groupMatchesList.map(renderMatch)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Tournament - Main Playoff Matches */}
                {isCustomTournament && mainPlayoffs.length > 0 && (
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 animate-fade-up" style={{ animationDelay: "200ms" }}>
                        <div className="flex items-center justify-between border-b border-foreground/10 bg-[var(--qc-bg-pure)] px-6 py-4">
                            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground font-tiktok">
                                Playoffs
                            </h2>
                            <div className="h-1 w-8 bg-foreground rounded-full opacity-50" />
                        </div>
                        <div className="p-6 space-y-2">
                            {mainPlayoffs.map(renderMatch)}
                        </div>
                    </div>
                )}

                {/* Custom Tournament - Third Place Match */}
                {isCustomTournament && thirdPlace && (
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 animate-fade-up" style={{ animationDelay: "250ms" }}>
                        <div className="flex items-center justify-between border-b border-foreground/10 bg-[var(--qc-bg-pure)] px-6 py-4">
                            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#333] font-tiktok">
                                Partido por el 3° Puesto
                            </h2>
                            <div className="h-1 w-8 bg-foreground/80 rounded-full opacity-50" />
                        </div>
                        <div className="p-6">
                            {renderMatch(thirdPlace)}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {matches.length === 0 && (
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-12 text-center animate-fade-up" style={{ animationDelay: "150ms" }}>
                        <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl text-foreground/20">?</span>
                        </div>
                        <p className="text-sm text-foreground/40">No hay partidos generados</p>
                        <p className="text-xs text-foreground/30 mt-2">
                            {isEliminationTournament
                                ? 'Genera el bracket desde el panel del torneo'
                                : 'Primero crea los grupos y genera el fixture'
                            }
                        </p>
                        <Link
                            href={`/admin/esport/${id}`}
                            className="inline-block mt-6 bg-foreground/10 border border-foreground/30 px-5 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider"
                        >
                            Volver al Torneo
                        </Link>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
