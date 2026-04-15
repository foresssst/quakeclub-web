"use client"
import { toast } from "sonner"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"
import { use } from "react"
import Image from "next/image"
import { systemConfirm } from "@/lib/system-modal"

interface Registration {
    id: string
    seed?: number | null
    status: string
    registeredAt?: string
    participantType?: string
    clan?: {
        id: string
        tag: string
        name: string
        avatarUrl?: string
    }
    tournamentTeam?: {
        id: string
        tag: string
        name: string
        avatarUrl?: string
    }
    player?: {
        username: string
    }
}

const TOURNAMENT_STATUSES = [
    { value: 'UPCOMING', label: 'Próximo' },
    { value: 'REGISTRATION_OPEN', label: 'Inscripciones Abiertas' },
    { value: 'REGISTRATION_CLOSED', label: 'Inscripciones Cerradas' },
    { value: 'IN_PROGRESS', label: 'En Curso' },
    { value: 'COMPLETED', label: 'Finalizado' },
    { value: 'CANCELLED', label: 'Cancelado' },
]

function compareRegistrationsBySeed(a: Registration, b: Registration) {
    const aSeed = a.seed ?? Number.MAX_SAFE_INTEGER
    const bSeed = b.seed ?? Number.MAX_SAFE_INTEGER

    if (aSeed !== bSeed) {
        return aSeed - bSeed
    }

    const aRegistered = a.registeredAt ? new Date(a.registeredAt).getTime() : 0
    const bRegistered = b.registeredAt ? new Date(b.registeredAt).getTime() : 0

    if (aRegistered !== bRegistered) {
        return aRegistered - bRegistered
    }

    return a.id.localeCompare(b.id)
}

export default function TournamentAdminPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const queryClient = useQueryClient()
    const [showAddClan, setShowAddClan] = useState(false)
    const [selectedClanId, setSelectedClanId] = useState("")
    const [showPlayoffConfig, setShowPlayoffConfig] = useState(false)
    const [playoffTeamCount, setPlayoffTeamCount] = useState(4)
    const [seedDrafts, setSeedDrafts] = useState<Record<string, string>>({})

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

    // Get available clans
    const { data: clansData } = useQuery({
        queryKey: ['available-clans'],
        queryFn: async () => {
            const res = await fetch('/api/clans')
            if (!res.ok) return { clans: [] }
            return res.json()
        },
        enabled: !!authData?.user?.isAdmin && showAddClan
    })

    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            const res = await fetch(`/api/admin/tournaments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al actualizar estado')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
        }
    })

    const approveRegistrationMutation = useMutation({
        mutationFn: async (registrationId: string) => {
            const res = await fetch(`/api/admin/tournaments/${id}/registrations/${registrationId}/approve`, {
                method: 'PUT'
            })
            if (!res.ok) throw new Error('Error')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
        }
    })

    const deleteRegistrationMutation = useMutation({
        mutationFn: async (registrationId: string) => {
            const res = await fetch(`/api/admin/tournaments/${id}/registrations/${registrationId}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error('Error al eliminar')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
        }
    })

    const addClanMutation = useMutation({
        mutationFn: async (clanId: string) => {
            const res = await fetch(`/api/esport/tournaments/${id}/inscribir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clanId, adminApproved: true })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al inscribir clan')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            setSelectedClanId("")
            setShowAddClan(false)
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const generatePlayoffsMutation = useMutation({
        mutationFn: async (teamCount: number) => {
            const res = await fetch(`/api/admin/tournaments/${id}/playoffs/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qualifyPerGroup: teamCount })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al generar playoffs')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            setShowPlayoffConfig(false)
            toast.success('Playoffs generados correctamente')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    // Generate elimination bracket
    const generateBracketMutation = useMutation({
        mutationFn: async (shuffle: boolean = false) => {
            const res = await fetch(`/api/admin/tournaments/${id}/generate-bracket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shuffle })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al generar bracket')
            }
            return res.json()
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            toast.success(data.message || 'Bracket generado correctamente')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    const updateSeedMutation = useMutation({
        mutationFn: async ({ registrationId, seed }: { registrationId: string; seed: number }) => {
            const res = await fetch(`/api/admin/tournaments/${id}/registrations/${registrationId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seed })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al actualizar seed')
            }
            return res.json()
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            setSeedDrafts((current) => {
                const next = { ...current }
                delete next[variables.registrationId]
                return next
            })
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    // Delete bracket
    const deleteBracketMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/admin/tournaments/${id}/generate-bracket`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al eliminar bracket')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            toast.success('Bracket eliminado')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    // Delete tournament
    const deleteTournamentMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/admin/tournaments/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al eliminar torneo')
            }
            return res.json()
        },
        onSuccess: () => {
            router.push('/admin/esport')
        },
        onError: (error: Error) => {
            toast.error(error.message)
        }
    })

    // Reset tournament (delete groups and matches)
    const resetTournamentMutation = useMutation({
        mutationFn: async (mode: 'all' | 'matches' | 'playoffs') => {
            const res = await fetch(`/api/admin/tournaments/${id}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al reiniciar torneo')
            }
            return res.json()
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tournament', id] })
            toast.success(data.message)
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

    const registrations: Registration[] = tournament?.registrations || []
    const pendingRegistrations = registrations.filter(r => r.status === 'PENDING')
    const approvedRegistrations = registrations
        .filter(r => r.status === 'APPROVED')
        .sort(compareRegistrationsBySeed)
    const groups = tournament?.groups || []
    const matches = tournament?.matches || []
    const groupMatches = matches.filter((m: any) => !m.isPlayoff)
    const playoffMatches = matches.filter((m: any) => m.isPlayoff)
    const completedGroupMatches = groupMatches.filter((m: any) => m.status === 'COMPLETED')
    const allGroupMatchesCompleted = groupMatches.length > 0 && completedGroupMatches.length === groupMatches.length
    const canGeneratePlayoffs = allGroupMatchesCompleted && playoffMatches.length === 0

    // Tournament format detection
    const isCustomTournament = tournament?.tournamentType === 'CUSTOM_GROUP'
    const isEliminationTournament = tournament?.format === 'SINGLE_ELIMINATION' || tournament?.format === 'DOUBLE_ELIMINATION'
    const hasBracket = matches.length > 0
    const canGenerateBracket = !isCustomTournament && approvedRegistrations.length >= 2 && !hasBracket

    const getFormatLabel = () => {
        if (isCustomTournament) return 'Fase de Grupos + Playoffs'
        if (tournament?.format === 'DOUBLE_ELIMINATION') return 'Double Elimination'
        if (tournament?.format === 'SINGLE_ELIMINATION') return 'Single Elimination'
        return 'Estándar'
    }

    return (
        <AdminLayout title={tournament?.name || 'Torneo'} subtitle={`${tournament?.gameType?.toUpperCase() || ''} - ${getFormatLabel()}`}>
            {/* Back Link & Actions */}
            <div className="flex items-start justify-between mb-6">
                <Link
                    href="/admin/esport"
                    className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider transition-colors"
                >
                    ← Volver a Torneos
                </Link>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/admin/esport/${id}/editar`}
                        className="bg-black/5 border border-foreground/10 px-4 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-black/10 hover:text-foreground uppercase tracking-wider rounded"
                    >
                        Editar
                    </Link>
                    <button
                        onClick={async () => {
                            if (await systemConfirm(`¿Estás seguro de eliminar "${tournament?.name}"?\n\nEsta acción eliminará todos los partidos, grupos e inscripciones asociadas.`, 'Eliminar Torneo')) {
                                deleteTournamentMutation.mutate()
                            }
                        }}
                        disabled={deleteTournamentMutation.isPending}
                        className="bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20 uppercase tracking-wider rounded disabled:opacity-50"
                    >
                        {deleteTournamentMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                    </button>
                    <button
                        onClick={async () => {
                            if (await systemConfirm(`¿Reiniciar el torneo "${tournament?.name}"?\n\nSe eliminarán TODOS los grupos, partidos y resultados.\nLas inscripciones se mantendrán.`, 'Reiniciar Torneo')) {
                                resetTournamentMutation.mutate('all')
                            }
                        }}
                        disabled={resetTournamentMutation.isPending}
                        className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20 uppercase tracking-wider rounded disabled:opacity-50"
                    >
                        {resetTournamentMutation.isPending ? 'Reiniciando...' : 'Reiniciar'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
                    {/* Status Control */}
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="text-xs text-foreground/40 uppercase tracking-wider">Estado del torneo:</span>
                            <select
                                value={tournament?.status || 'UPCOMING'}
                                onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                                disabled={updateStatusMutation.isPending}
                                className="px-4 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm font-medium text-foreground uppercase tracking-wider focus:outline-none focus:border-foreground/50 cursor-pointer rounded-lg"
                            >
                                {TOURNAMENT_STATUSES.map((s) => (
                                    <option key={s.value} value={s.value} className="bg-card">
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                            {updateStatusMutation.isPending && (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-[#1a1a1e]" />
                            )}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up" style={{ animationDelay: "50ms" }}>
                            <div className="text-3xl font-bold text-foreground font-tiktok">{approvedRegistrations.length}</div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mt-1">Equipos</div>
                        </div>
                        <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up" style={{ animationDelay: "100ms" }}>
                            <div className="text-3xl font-bold text-foreground font-tiktok">{groups.length}</div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mt-1">Grupos</div>
                        </div>
                        <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up" style={{ animationDelay: "150ms" }}>
                            <div className="text-3xl font-bold text-foreground font-tiktok">{matches.length}</div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mt-1">Partidos</div>
                        </div>
                        <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 animate-fade-up" style={{ animationDelay: "200ms" }}>
                            <div className="text-3xl font-bold text-foreground font-tiktok">
                                {matches.filter((m: any) => m.status === 'COMPLETED').length}
                            </div>
                            <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 mt-1">Completados</div>
                        </div>
                    </div>

                    {/* Quick Actions - Different based on tournament type */}
                    {isCustomTournament ? (
                        /* Custom Tournament (Groups + Playoffs) */
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Link
                                href={`/admin/esport/${id}/grupos`}
                                className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 hover:border-foreground/30 transition-all group animate-fade-up"
                                style={{ animationDelay: "250ms" }}
                            >
                                <h3 className="text-sm font-bold text-foreground mb-2 group-hover:text-foreground transition-colors font-tiktok uppercase tracking-wider">
                                    Grupos & Fixture
                                </h3>
                                <p className="text-xs text-foreground/50">Crear grupos y generar partidos</p>
                                <div className="mt-4 text-xs text-foreground/30">
                                    {groups.length} grupos • {groupMatches.length} partidos
                                </div>
                            </Link>

                            <Link
                                href={`/admin/esport/${id}/partidos`}
                                className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 hover:border-foreground/30 transition-all group animate-fade-up"
                                style={{ animationDelay: "300ms" }}
                            >
                                <h3 className="text-sm font-bold text-foreground mb-2 group-hover:text-foreground transition-colors font-tiktok uppercase tracking-wider">
                                    Resultados
                                </h3>
                                <p className="text-xs text-foreground/50">Registrar resultados de partidos</p>
                                <div className="mt-4 text-xs text-foreground/30">
                                    {completedGroupMatches.length}/{groupMatches.length} completados
                                </div>
                            </Link>

                            {canGeneratePlayoffs || showPlayoffConfig ? (
                                <div className="bg-foreground/10 backdrop-blur-md shadow-sm border border-foreground/30 p-5 animate-fade-up" style={{ animationDelay: "350ms" }}>
                                    <h3 className="text-sm font-bold text-foreground mb-2 font-tiktok uppercase tracking-wider">
                                        Generar Playoffs
                                    </h3>
                                    <p className="text-xs text-foreground/50 mb-4">Fase de grupos completada</p>

                                    {/* Selector de equipos */}
                                    <div className="mb-4">
                                        <label className="text-xs text-foreground/60 block mb-2">
                                            ¿Cuántos equipos clasifican?
                                        </label>
                                        <select
                                            value={playoffTeamCount}
                                            onChange={(e) => setPlayoffTeamCount(Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none rounded-lg"
                                        >
                                            <option value={2}>2 equipos (Final directa)</option>
                                            <option value={4}>4 equipos (Semifinales + Final)</option>
                                            <option value={8}>8 equipos (Cuartos + Semi + Final)</option>
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => generatePlayoffsMutation.mutate(playoffTeamCount)}
                                            disabled={generatePlayoffsMutation.isPending}
                                            className="flex-1 bg-foreground text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50"
                                        >
                                            {generatePlayoffsMutation.isPending ? 'Generando...' : 'Generar Playoffs'}
                                        </button>
                                    </div>

                                    <p className="text-[10px] text-foreground/30 mt-3">
                                        {playoffTeamCount === 2 && "Se creará 1 partido: Final"}
                                        {playoffTeamCount === 4 && "Se crearán 4 partidos: 2 Semifinales, Final y 3° Puesto"}
                                        {playoffTeamCount === 8 && "Se crearán 8 partidos: 4 Cuartos, 2 Semi, Final y 3° Puesto"}
                                    </p>
                                </div>
                            ) : playoffMatches.length > 0 ? (
                                <Link
                                    href={`/admin/esport/${id}/partidos`}
                                    className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 hover:border-foreground/30 transition-all group animate-fade-up"
                                    style={{ animationDelay: "350ms" }}
                                >
                                    <h3 className="text-sm font-bold text-foreground mb-2 group-hover:text-foreground transition-colors font-tiktok uppercase tracking-wider">
                                        Playoffs
                                    </h3>
                                    <p className="text-xs text-foreground/50">Gestionar partidos de playoffs</p>
                                    <div className="mt-4 text-xs text-foreground/30">
                                        {playoffMatches.filter((m: any) => m.status === 'COMPLETED').length}/{playoffMatches.length} completados
                                    </div>
                                </Link>
                            ) : (
                                <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 opacity-50 animate-fade-up" style={{ animationDelay: "350ms" }}>
                                    <h3 className="text-sm font-bold text-foreground/40 mb-2 font-tiktok uppercase tracking-wider">
                                        Playoffs
                                    </h3>
                                    <p className="text-xs text-foreground/30">Completa la fase de grupos</p>
                                    <div className="mt-4 text-xs text-foreground/20">
                                        {completedGroupMatches.length}/{groupMatches.length} partidos
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Elimination Tournament (Single/Double) */
                        <div className="grid gap-4 sm:grid-cols-2">
                            {/* Generate Bracket Button */}
                            {canGenerateBracket ? (
                                <div
                                    className="bg-foreground/10 backdrop-blur-md shadow-sm border border-foreground/30 p-5 transition-all text-left animate-fade-up"
                                    style={{ animationDelay: "250ms" }}
                                >
                                    <h3 className="text-sm font-bold text-foreground mb-2 font-tiktok uppercase tracking-wider">
                                        Generar Bracket
                                    </h3>
                                    <p className="text-xs text-foreground/50">
                                        {tournament?.format === 'DOUBLE_ELIMINATION' ? 'Double Elimination' : 'Single Elimination'}
                                    </p>
                                    <p className="mt-2 text-[11px] text-foreground/40">
                                        Puedes respetar los seeds del admin o generar una llave aleatoria
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            onClick={async () => {
                                                const format = tournament?.format === 'DOUBLE_ELIMINATION' ? 'Double Elimination' : 'Single Elimination'
                                                if (await systemConfirm(`¿Generar bracket ${format} usando el orden de seeds actual?\n\nLa llave seguirá exactamente el orden definido en la lista de equipos inscritos.`, 'Generar Bracket por Seeds')) {
                                                    generateBracketMutation.mutate(false)
                                                }
                                            }}
                                            disabled={generateBracketMutation.isPending}
                                            className="bg-foreground text-white px-4 py-2 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50 rounded-lg"
                                        >
                                            Usar seeds
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const format = tournament?.format === 'DOUBLE_ELIMINATION' ? 'Double Elimination' : 'Single Elimination'
                                                if (await systemConfirm(`¿Generar bracket ${format} aleatorio?\n\nEl sistema mezclará los equipos y no respetará el orden de seeds actual.`, 'Generar Bracket Aleatorio')) {
                                                    generateBracketMutation.mutate(true)
                                                }
                                            }}
                                            disabled={generateBracketMutation.isPending}
                                            className="bg-black/5 border border-foreground/10 px-4 py-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-black/10 disabled:opacity-50 rounded-lg uppercase tracking-wider"
                                        >
                                            Aleatorio
                                        </button>
                                    </div>
                                    <div className="mt-4 text-xs text-foreground">
                                        {generateBracketMutation.isPending ? 'Generando...' : `${approvedRegistrations.length} equipos listos`}
                                    </div>
                                </div>
                            ) : hasBracket ? (
                                <div className="bg-card backdrop-blur-md shadow-sm border border-foreground/20 p-5 animate-fade-up" style={{ animationDelay: "250ms" }}>
                                    <h3 className="text-sm font-bold text-foreground mb-2 font-tiktok uppercase tracking-wider">
                                        Bracket Generado
                                    </h3>
                                    <p className="text-xs text-foreground/50">
                                        {tournament?.format === 'DOUBLE_ELIMINATION' ? 'Double Elimination' : 'Single Elimination'}
                                    </p>
                                    <div className="mt-4 flex items-center gap-3">
                                        <span className="text-xs text-foreground/40">{matches.length} partidos</span>
                                        <button
                                            onClick={async () => {
                                                if (await systemConfirm('¿Eliminar el bracket actual?\n\nEsto borrará todos los partidos y resultados.', 'Eliminar Bracket')) {
                                                    deleteBracketMutation.mutate()
                                                }
                                            }}
                                            disabled={deleteBracketMutation.isPending}
                                            className="text-xs text-red-500/70 hover:text-red-500 transition-colors"
                                        >
                                            {deleteBracketMutation.isPending ? 'Eliminando...' : 'Reiniciar bracket'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 opacity-50 animate-fade-up" style={{ animationDelay: "250ms" }}>
                                    <h3 className="text-sm font-bold text-foreground/40 mb-2 font-tiktok uppercase tracking-wider">
                                        Generar Bracket
                                    </h3>
                                    <p className="text-xs text-foreground/30">Necesitas al menos 2 equipos</p>
                                    <div className="mt-4 text-xs text-foreground/20">
                                        {approvedRegistrations.length} equipos inscritos
                                    </div>
                                </div>
                            )}

                            {/* Manage Results */}
                            <Link
                                href={`/admin/esport/${id}/partidos`}
                                className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 hover:border-foreground/30 transition-all group animate-fade-up"
                                style={{ animationDelay: "300ms" }}
                            >
                                <h3 className="text-sm font-bold text-foreground mb-2 group-hover:text-foreground transition-colors font-tiktok uppercase tracking-wider">
                                    Resultados
                                </h3>
                                <p className="text-xs text-foreground/50">Registrar resultados de partidos</p>
                                <div className="mt-4 text-xs text-foreground/30">
                                    {matches.filter((m: any) => m.status === 'COMPLETED').length}/{matches.length} completados
                                </div>
                            </Link>

                            {/* Map Pool & Pick/Ban */}
                            <Link
                                href={`/admin/esport/${id}/map-pool`}
                                className="bg-card backdrop-blur-md shadow-sm border border-black/5 p-5 hover:border-foreground/30 transition-all group animate-fade-up"
                                style={{ animationDelay: "350ms" }}
                            >
                                <h3 className="text-sm font-bold text-foreground mb-2 group-hover:text-foreground transition-colors font-tiktok uppercase tracking-wider">
                                    Map Pool & Pick/Ban
                                </h3>
                                <p className="text-xs text-foreground/50">Configurar mapas y sistema de veto</p>
                            </Link>
                        </div>
                    )}

                    {/* Pending Registrations */}
                    {pendingRegistrations.length > 0 && (
                        <div className="bg-card backdrop-blur-md shadow-sm border border-foreground/30 animate-fade-up" style={{ animationDelay: "400ms" }}>
                            <div className="flex items-center justify-between border-b border-foreground/10 bg-[var(--qc-bg-pure)] px-6 py-4">
                                <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground font-tiktok">
                                    Inscripciones Pendientes
                                </h2>
                                <span className="bg-foreground/20 text-foreground px-2.5 py-1 text-[10px] font-bold rounded-lg">
                                    {pendingRegistrations.length}
                                </span>
                            </div>
                            <div className="divide-y divide-white/5">
                                {pendingRegistrations.map((reg) => {
                                    const teamInfo = reg.tournamentTeam || reg.clan
                                    const displayTag = teamInfo?.tag || reg.player?.username || '??'
                                    const displayName = teamInfo?.name || reg.player?.username || 'TBD'
                                    const avatarUrl = teamInfo?.avatarUrl
                                    return (
                                    <div key={reg.id} className="flex items-center justify-between px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            {avatarUrl ? (
                                                <Image
                                                    src={avatarUrl}
                                                    alt={displayName}
                                                    width={36}
                                                    height={36}
                                                    className="rounded-lg border border-foreground/10"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 bg-black/10 rounded-lg" />
                                            )}
                                            <div>
                                                <span className="text-sm font-bold text-foreground">[{displayTag}]</span>
                                                <span className="text-xs text-foreground/40 ml-2">{displayName}</span>
                                                {reg.participantType === 'TEAM' && (
                                                    <span className="text-[10px] text-foreground/60 ml-2 bg-foreground/10 px-1.5 py-0.5 rounded">Equipo</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => approveRegistrationMutation.mutate(reg.id)}
                                                disabled={approveRegistrationMutation.isPending}
                                                className="bg-foreground/10 border border-foreground/30 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider disabled:opacity-50"
                                            >
                                                Aprobar
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (await systemConfirm(`¿Eliminar inscripción de [${displayTag}]?`, 'Eliminar Inscripción')) {
                                                        deleteRegistrationMutation.mutate(reg.id)
                                                    }
                                                }}
                                                disabled={deleteRegistrationMutation.isPending}
                                                className="bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20 uppercase tracking-wider disabled:opacity-50"
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Approved Teams */}
                    <div className="bg-card backdrop-blur-md shadow-sm border border-black/5 animate-fade-up" style={{ animationDelay: "450ms" }}>
                        <div className="flex items-center justify-between border-b border-foreground/10 bg-[var(--qc-bg-pure)] px-6 py-4">
                            <div className="flex items-center gap-3">
                                <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground font-tiktok">
                                    Equipos Inscritos
                                </h2>
                                <span className="bg-black/10 text-foreground/60 px-2.5 py-1 text-[10px] font-bold rounded-lg">
                                    {approvedRegistrations.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowAddClan(!showAddClan)}
                                className="bg-foreground/10 border border-foreground/30 px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/20 uppercase tracking-wider"
                            >
                                {showAddClan ? 'Cancelar' : 'Agregar Clan'}
                            </button>
                        </div>
                        <div className="border-b border-foreground/10 bg-foreground/[0.02] px-6 py-3 text-[11px] text-black/45">
                            Esta lista define el seeding del bracket. Seed `#1` queda arriba y los cruces se generan respetando este orden.
                        </div>

                        {/* Add Clan Form */}
                        {showAddClan && (
                            <div className="p-6 border-b border-foreground/10 bg-card">
                                <div className="flex gap-3">
                                    <select
                                        value={selectedClanId}
                                        onChange={(e) => setSelectedClanId(e.target.value)}
                                        className="flex-1 px-4 py-2.5 bg-foreground/[0.04] border border-foreground/10 text-sm text-foreground focus:border-foreground/50 focus:outline-none rounded-lg"
                                    >
                                        <option value="">Seleccionar clan...</option>
                                        {(clansData?.clans || [])
                                            .filter((clan: any) => !registrations.some((r: Registration) => r.clan?.id === clan.id))
                                            .map((clan: any) => (
                                                <option key={clan.id} value={clan.id} className="bg-card">
                                                    [{clan.tag}] {clan.name}
                                                </option>
                                            ))
                                        }
                                    </select>
                                    <button
                                        onClick={() => selectedClanId && addClanMutation.mutate(selectedClanId)}
                                        disabled={!selectedClanId || addClanMutation.isPending}
                                        className="bg-foreground text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50"
                                    >
                                        {addClanMutation.isPending ? 'Agregando...' : 'Agregar'}
                                    </button>
                                </div>
                                <p className="text-xs text-foreground/40 mt-3">
                                    Selecciona un clan para inscribirlo directamente (se aprobará automáticamente)
                                </p>
                            </div>
                        )}

                        {approvedRegistrations.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-lg text-foreground/20">?</span>
                                </div>
                                <p className="text-sm text-foreground/40">No hay equipos inscritos</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {approvedRegistrations.map((reg, index) => {
                                    const teamInfo = reg.tournamentTeam || reg.clan
                                    const displayTag = teamInfo?.tag || reg.player?.username || '??'
                                    const displayName = teamInfo?.name || reg.player?.username || 'TBD'
                                    const avatarUrl = teamInfo?.avatarUrl
                                    const currentSeed = reg.seed ?? index + 1
                                    const displayedSeed = seedDrafts[reg.id] ?? String(currentSeed)
                                    return (
                                    <div key={reg.id} className="flex items-center justify-between px-6 py-3 hover:bg-foreground/[0.02] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 text-center">
                                                <div className="text-[10px] uppercase tracking-wider text-black/35">Seed</div>
                                                <div className="text-sm font-bold text-foreground">#{currentSeed}</div>
                                            </div>
                                            {avatarUrl ? (
                                                <Image
                                                    src={avatarUrl}
                                                    alt={displayName}
                                                    width={28}
                                                    height={28}
                                                    className="rounded-lg border border-foreground/10"
                                                />
                                            ) : (
                                                <div className="w-7 h-7 bg-black/10 rounded-lg" />
                                            )}
                                            <span className="text-sm font-bold text-foreground">[{displayTag}]</span>
                                            <span className="text-xs text-foreground/40">{displayName}</span>
                                            {reg.participantType === 'TEAM' && (
                                                <span className="text-[10px] text-foreground/60 bg-foreground/10 px-1.5 py-0.5 rounded">Equipo</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={displayedSeed}
                                                    onChange={(e) => {
                                                        const value = e.target.value
                                                        setSeedDrafts((current) => ({
                                                            ...current,
                                                            [reg.id]: value
                                                        }))
                                                    }}
                                                    className="w-16 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2 py-1 text-sm font-medium text-foreground focus:border-foreground/40 focus:outline-none"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const parsedSeed = Number(displayedSeed)
                                                        if (!Number.isInteger(parsedSeed) || parsedSeed < 1) {
                                                            toast.warning('Ingresa un seed valido')
                                                            return
                                                        }
                                                        updateSeedMutation.mutate({ registrationId: reg.id, seed: parsedSeed })
                                                    }}
                                                    disabled={updateSeedMutation.isPending}
                                                    className="text-xs text-foreground/65 hover:text-foreground transition-colors"
                                                >
                                                    Guardar seed
                                                </button>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (await systemConfirm(`¿Eliminar a [${displayTag}] del torneo?`, 'Eliminar del Torneo')) {
                                                        deleteRegistrationMutation.mutate(reg.id)
                                                    }
                                                }}
                                                disabled={deleteRegistrationMutation.isPending}
                                                className="text-xs text-red-500/50 hover:text-red-500 transition-colors"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* View Public Page */}
                    <div className="text-center pt-4">
                        <Link
                            href={`/esport/${id}`}
                            className="text-xs font-medium text-[#333] transition-colors hover:text-foreground uppercase tracking-wider"
                        >
                            Ver página pública del torneo →
                        </Link>
                    </div>
            </div>
        </AdminLayout>
    )
}
