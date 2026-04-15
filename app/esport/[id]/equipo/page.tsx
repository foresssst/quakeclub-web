"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { use } from "react"
import Link from "next/link"
import Image from "next/image"

export default function EquipoTorneoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = use(params)
    const router = useRouter()
    const queryClient = useQueryClient()

    const [teamName, setTeamName] = useState("")
    const [teamTag, setTeamTag] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [acceptedRules, setAcceptedRules] = useState(false)

    // Auth
    const { data: authData, isLoading: loadingAuth } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            const res = await fetch('/api/auth/me')
            if (!res.ok) return { user: null }
            return res.json()
        }
    })

    // Tournament
    const { data: tournamentData, isLoading: loadingTournament } = useQuery({
        queryKey: ['tournament', tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}`)
            if (!res.ok) throw new Error('Error al cargar torneo')
            return res.json()
        }
    })
    const tournament = tournamentData?.tournament || tournamentData

    // My teams in this tournament
    const { data: teamsData, isLoading: loadingTeams } = useQuery({
        queryKey: ['tournament-teams', tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/teams`)
            if (!res.ok) return { teams: [] }
            return res.json()
        },
        enabled: !!authData?.user
    })

    // Find the user's team (where they are captain)
    const myTeam = teamsData?.teams?.find(
        (t: any) => t.captain?.steamId === authData?.user?.steamId
    )

    // Search players
    const { data: searchResults } = useQuery({
        queryKey: ['search-players', searchQuery],
        queryFn: async () => {
            if (!searchQuery || searchQuery.length < 2) return { players: [] }
            const res = await fetch(`/api/players/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
            if (!res.ok) return { players: [] }
            return res.json()
        },
        enabled: searchQuery.length >= 2
    })

    // Create team
    const createTeamMutation = useMutation({
        mutationFn: async (data: { name: string; tag: string }) => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al crear equipo')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament-teams', tournamentId] })
            setTeamName("")
            setTeamTag("")
        },
        onError: (error: Error) => {
            alert(error.message)
        }
    })

    // Invite player
    const inviteMutation = useMutation({
        mutationFn: async ({ teamId, playerId }: { teamId: string; playerId: string }) => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/teams/${teamId}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al invitar')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament-teams', tournamentId] })
            setSearchQuery("")
        },
        onError: (error: Error) => {
            alert(error.message)
        }
    })

    // Remove member
    const removeMemberMutation = useMutation({
        mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/teams/${teamId}/members/${memberId}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al remover')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament-teams', tournamentId] })
        },
        onError: (error: Error) => {
            alert(error.message)
        }
    })

    // Register team
    const registerTeamMutation = useMutation({
        mutationFn: async (teamId: string) => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/inscribir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tournamentTeamId: teamId })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al inscribir equipo')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
            queryClient.invalidateQueries({ queryKey: ['tournament-teams', tournamentId] })
            router.push(`/esport/${tournamentId}`)
        },
        onError: (error: Error) => {
            alert(error.message)
        }
    })

    const isLoading = loadingTournament || loadingAuth || (authData?.user && loadingTeams)

    if (isLoading || !tournament) {
        return (
            <div className="relative min-h-screen">
                <div className="pt-8 sm:pt-12 flex items-center justify-center">
                    <p className="text-foreground/40">Cargando...</p>
                </div>
            </div>
        )
    }

    // Not logged in
    if (!authData?.user) {
        return (
            <div className="relative min-h-screen">
                <div className="pt-8 sm:pt-12 max-w-lg mx-auto px-3 sm:px-4">
                    <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-foreground font-tiktok uppercase mb-2">SESION REQUERIDA</h2>
                        <p className="text-sm text-foreground/60 mb-6">
                            Debes iniciar sesion para crear un equipo de torneo
                        </p>
                        <Link
                            href={`/login?returnTo=/esport/${tournamentId}/equipo`}
                            className="inline-block px-6 py-3 bg-foreground text-white font-bold uppercase text-sm hover:brightness-110 transition-all font-tiktok tracking-wider"
                        >
                            INICIAR SESION
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Registration closed
    if (tournament?.status !== 'REGISTRATION_OPEN' && !myTeam) {
        return (
            <div className="relative min-h-screen">
                <div className="pt-8 sm:pt-12 max-w-lg mx-auto px-3 sm:px-4">
                    <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-foreground font-tiktok uppercase mb-2">INSCRIPCIONES CERRADAS</h2>
                        <p className="text-sm text-foreground/60 mb-6">
                            Las inscripciones para este torneo no estan abiertas
                        </p>
                        <Link
                            href={`/esport/${tournamentId}`}
                            className="inline-block px-6 py-3 bg-black/10 text-foreground font-bold uppercase text-sm hover:bg-black/10 transition-all font-tiktok tracking-wider"
                        >
                            VOLVER
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const acceptedMembers = myTeam?.members?.filter((m: any) => m.status === 'ACCEPTED') || []
    const pendingMembers = myTeam?.members?.filter((m: any) => m.status === 'PENDING') || []
    const minRoster = tournament?.minRosterSize || 2
    const canRegister = myTeam && acceptedMembers.length >= minRoster && !myTeam.registration

    return (
        <div className="relative min-h-screen">
            <div className="pt-8 sm:pt-12 max-w-xl mx-auto px-3 sm:px-4 pb-12 space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link
                        href={`/esport/${tournamentId}`}
                        className="text-[10px] text-[#333] hover:text-foreground uppercase tracking-wider transition-colors"
                    >
                        &larr; Volver al torneo
                    </Link>
                </div>

                {/* Tournament Header */}
                <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl">
                    <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-6 py-4">
                        <h1 className="text-lg font-bold text-foreground font-tiktok uppercase tracking-wider">{tournament?.name || 'Torneo'}</h1>
                        <p className="text-sm text-foreground/40 mt-1">Equipo de Torneo</p>
                    </div>
                </div>

                {/* No team yet - Create Team Form */}
                {!myTeam && (
                    <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl animate-fade-up">
                        <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-6 py-4">
                            <h2 className="text-sm font-bold text-foreground font-tiktok uppercase tracking-wider">Crear Equipo</h2>
                            <p className="text-xs text-foreground/40 mt-1">
                                Crea un equipo para este torneo. Podras invitar jugadores de cualquier clan.
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] text-foreground/40 uppercase tracking-wider block mb-2">Nombre del equipo</label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    placeholder="Ej: Los Invencibles"
                                    maxLength={50}
                                    className="w-full px-4 py-3 bg-foreground/[0.04] border border-black/10 text-sm text-foreground placeholder-black/30 focus:border-foreground/50 focus:outline-none rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-foreground/40 uppercase tracking-wider block mb-2">Tag del equipo</label>
                                <input
                                    type="text"
                                    value={teamTag}
                                    onChange={(e) => setTeamTag(e.target.value.toUpperCase())}
                                    placeholder="Ej: INV"
                                    maxLength={10}
                                    className="w-full px-4 py-3 bg-foreground/[0.04] border border-black/10 text-sm text-foreground placeholder-black/30 focus:border-foreground/50 focus:outline-none rounded-lg uppercase"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    if (!teamName.trim() || !teamTag.trim()) {
                                        alert('Ingresa nombre y tag del equipo')
                                        return
                                    }
                                    createTeamMutation.mutate({ name: teamName.trim(), tag: teamTag.trim() })
                                }}
                                disabled={createTeamMutation.isPending || !teamName.trim() || !teamTag.trim()}
                                className="w-full px-6 py-3 bg-foreground text-white font-bold uppercase text-sm hover:brightness-110 transition-all disabled:opacity-50 font-tiktok tracking-wider rounded-lg"
                            >
                                {createTeamMutation.isPending ? 'CREANDO...' : 'CREAR EQUIPO'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Team exists - Management */}
                {myTeam && (
                    <>
                        {/* Team Info */}
                        <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl animate-fade-up">
                            <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-bold text-foreground font-tiktok uppercase tracking-wider">
                                            [{myTeam.tag}] {myTeam.name}
                                        </h2>
                                        <p className="text-xs text-foreground/40 mt-1">
                                            Tu eres el capitan de este equipo
                                        </p>
                                    </div>
                                    {myTeam.registration && (
                                        <span className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-foreground/20 text-foreground border border-foreground/30 rounded-full">
                                            Inscrito
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Members */}
                            <div className="divide-y divide-black/[0.06]">
                                {/* Accepted */}
                                {acceptedMembers.map((member: any) => (
                                    <div key={member.id} className="px-6 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-foreground/10 rounded-lg flex items-center justify-center">
                                                <span className="text-[10px] text-foreground font-bold">
                                                    {(member.player?.username || '??').substring(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-foreground">{member.player?.username || 'Jugador'}</span>
                                                {member.role === 'capitan' && (
                                                    <span className="text-[10px] text-foreground ml-2 bg-foreground/10 px-1.5 py-0.5 rounded">Capitan</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-foreground uppercase tracking-wider">Aceptado</span>
                                            {member.role !== 'capitan' && !myTeam.registration && (
                                                <button
                                                    onClick={() => removeMemberMutation.mutate({ teamId: myTeam.id, memberId: member.id })}
                                                    className="text-xs text-red-500/50 hover:text-red-500 transition-colors ml-2"
                                                >
                                                    Quitar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Pending */}
                                {pendingMembers.map((member: any) => (
                                    <div key={member.id} className="px-6 py-3 flex items-center justify-between bg-foreground/[0.02]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center">
                                                <span className="text-[10px] text-foreground/40 font-bold">
                                                    {(member.player?.username || '??').substring(0, 2).toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="text-sm text-foreground/60">{member.player?.username || 'Jugador'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-foreground/40 uppercase tracking-wider">Pendiente</span>
                                            {!myTeam.registration && (
                                                <button
                                                    onClick={() => removeMemberMutation.mutate({ teamId: myTeam.id, memberId: member.id })}
                                                    className="text-xs text-red-500/50 hover:text-red-500 transition-colors ml-2"
                                                >
                                                    Quitar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Roster info */}
                            <div className="px-6 py-3 border-t border-foreground/[0.06] bg-[var(--qc-bg-pure)]/30">
                                <div className="flex items-center justify-between text-xs text-foreground/40">
                                    <span>{acceptedMembers.length} miembros aceptados</span>
                                    <span>Minimo requerido: {minRoster}</span>
                                </div>
                            </div>
                        </div>

                        {/* Invite Players - Only if not registered yet */}
                        {!myTeam.registration && (
                            <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl animate-fade-up">
                                <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-6 py-4">
                                    <h3 className="text-sm font-bold text-foreground font-tiktok uppercase tracking-wider">Invitar Jugadores</h3>
                                    <p className="text-xs text-foreground/40 mt-1">
                                        Busca jugadores por nombre para invitarlos a tu equipo
                                    </p>
                                </div>
                                <div className="p-6">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar jugador por nombre..."
                                        className="w-full px-4 py-3 bg-foreground/[0.04] border border-black/10 text-sm text-foreground placeholder-black/30 focus:border-foreground/50 focus:outline-none rounded-lg"
                                    />

                                    {/* Search results */}
                                    {searchResults?.players && searchResults.players.length > 0 && (
                                        <div className="mt-3 divide-y divide-black/[0.06] border border-foreground/[0.06] rounded-lg overflow-hidden">
                                            {searchResults.players.map((player: any) => {
                                                const isAlreadyMember = myTeam.members?.some(
                                                    (m: any) => m.player?.id === player.id || m.playerId === player.id
                                                )
                                                const isMe = player.steamId === authData?.user?.steamId

                                                return (
                                                    <div key={player.id} className="px-4 py-3 flex items-center justify-between hover:bg-foreground/[0.02]">
                                                        <div className="flex items-center gap-3">
                                                            {player.avatar ? (
                                                                <Image src={player.avatar} alt="" width={28} height={28} className="rounded-lg" />
                                                            ) : (
                                                                <div className="w-7 h-7 bg-black/10 rounded-lg" />
                                                            )}
                                                            <span className="text-sm font-bold text-foreground">{player.username}</span>
                                                        </div>
                                                        {isMe ? (
                                                            <span className="text-[10px] text-foreground/30 uppercase">Tu</span>
                                                        ) : isAlreadyMember ? (
                                                            <span className="text-[10px] text-foreground uppercase">Ya invitado</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => inviteMutation.mutate({ teamId: myTeam.id, playerId: player.id })}
                                                                disabled={inviteMutation.isPending}
                                                                className="px-3 py-1.5 bg-foreground/10 border border-foreground/30 text-[10px] font-bold text-foreground uppercase tracking-wider hover:bg-foreground/20 transition-colors disabled:opacity-50"
                                                            >
                                                                Invitar
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {searchQuery.length >= 2 && searchResults?.players?.length === 0 && (
                                        <p className="mt-3 text-xs text-foreground/40 text-center py-3">
                                            No se encontraron jugadores con ese nombre
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Register Team Button */}
                        {!myTeam.registration && (
                            <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl animate-fade-up">
                                <div className="p-6">
                                    {/* Accept Rules */}
                                    <label className="flex items-start gap-3 cursor-pointer mb-4">
                                        <input
                                            type="checkbox"
                                            checked={acceptedRules}
                                            onChange={(e) => setAcceptedRules(e.target.checked)}
                                            className="mt-0.5 h-5 w-5 rounded border-black/20 bg-black/10 text-foreground focus:ring-foreground accent-[#1a1a1e]"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm text-foreground">
                                                He leido y acepto las{' '}
                                                <Link href={`/esport/${tournamentId}`} target="_blank" className="text-foreground hover:underline">
                                                    bases del torneo
                                                </Link>
                                            </p>
                                        </div>
                                    </label>

                                    <button
                                        onClick={() => {
                                            if (!acceptedRules) {
                                                alert('Debes aceptar las bases del torneo')
                                                return
                                            }
                                            registerTeamMutation.mutate(myTeam.id)
                                        }}
                                        disabled={!canRegister || !acceptedRules || registerTeamMutation.isPending}
                                        className="w-full px-6 py-4 bg-foreground text-white font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-tiktok tracking-wider rounded-lg"
                                    >
                                        {registerTeamMutation.isPending
                                            ? 'INSCRIBIENDO...'
                                            : acceptedMembers.length < minRoster
                                            ? `NECESITAS ${minRoster - acceptedMembers.length} MIEMBROS MAS`
                                            : 'INSCRIBIR EQUIPO AL TORNEO'
                                        }
                                    </button>

                                    {acceptedMembers.length < minRoster && (
                                        <p className="text-xs text-foreground/40 text-center mt-3">
                                            Necesitas al menos {minRoster} miembros aceptados para inscribir el equipo
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Already registered message */}
                        {myTeam.registration && (
                            <div className="bg-foreground/5 border border-foreground/20 rounded-xl p-6 text-center animate-fade-up">
                                <h3 className="text-sm font-bold text-foreground mb-1">Equipo inscrito</h3>
                                <p className="text-xs text-foreground/50">
                                    Tu equipo [{myTeam.tag}] esta inscrito en este torneo.
                                    {myTeam.registration.status === 'PENDING' && ' Pendiente de aprobacion.'}
                                    {myTeam.registration.status === 'APPROVED' && ' Inscripcion aprobada.'}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
