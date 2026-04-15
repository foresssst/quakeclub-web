"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { use } from "react"
import Link from "next/link"
import Image from "next/image"
import { DEFAULT_CLAN_AVATAR } from "@/components/flag-clan"

export default function InscribirPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: tournamentId } = use(params)
    const router = useRouter()
    const queryClient = useQueryClient()

    const [acceptedRules, setAcceptedRules] = useState(false)

    // Get current user
    const { data: authData, isLoading: loadingAuth } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            const res = await fetch('/api/auth/me')
            if (!res.ok) return { user: null }
            return res.json()
        }
    })

    // Get tournament details
    const { data: tournamentData, isLoading: loadingTournament } = useQuery({
        queryKey: ['tournament', tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}`)
            if (!res.ok) throw new Error('Error al cargar torneo')
            return res.json()
        }
    })

    const tournament = tournamentData?.tournament

    // Get user's clan
    const { data: clanData, isLoading: loadingClan } = useQuery({
        queryKey: ['myClan', authData?.user?.steamId],
        queryFn: async () => {
            if (!authData?.user?.steamId) return null
            const res = await fetch(`/api/clans/my-membership?steamId=${authData.user.steamId}`)
            if (!res.ok) return null
            return res.json()
        },
        enabled: !!authData?.user?.steamId
    })

    const clan = clanData?.clan
    const isFounder = clanData?.role === 'FOUNDER'

    // Check if already registered
    const isAlreadyRegistered = clan && tournament?.registrations?.some(
        (r: any) => r.clan?.id === clan?.id
    )

    // Register mutation
    const registerMutation = useMutation({
        mutationFn: async (data: { clanId: string }) => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/inscribir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al inscribir')
            }

            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
            router.push(`/esport/${tournamentId}`)
        },
        onError: (error: Error) => {
            alert(error.message)
        }
    })

    const handleSubmit = () => {
        if (!clan) return

        if (!acceptedRules) {
            alert('Debes aceptar las bases del torneo')
            return
        }

        registerMutation.mutate({ clanId: clan.id })
    }

    // Show loading while any data is being fetched
    const isLoading = loadingTournament || loadingAuth || (authData?.user?.steamId && loadingClan)


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
                        <h2 className="text-xl font-bold text-foreground font-tiktok uppercase mb-2">SESIÓN REQUERIDA</h2>
                        <p className="text-sm text-foreground/60 mb-6">
                            Debes iniciar sesión para inscribir tu clan
                        </p>
                        <Link
                            href={`/login?returnTo=/esport/${tournamentId}/inscribir`}
                            className="inline-block px-6 py-3 bg-foreground text-white font-bold uppercase text-sm hover:brightness-110 transition-all font-tiktok tracking-wider"
                        >
                            INICIAR SESIÓN
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // No clan or not founder - show option to create clan
    if (!clan || !isFounder) {
        return (
            <div className="relative min-h-screen">
                <div className="pt-8 sm:pt-12 max-w-lg mx-auto px-3 sm:px-4">
                    <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl p-8 text-center">
                        {!clan ? (
                            <>
                                <h2 className="text-xl font-bold text-foreground font-tiktok uppercase mb-2">SIN CLAN</h2>
                                <p className="text-sm text-foreground/60 mb-6">
                                    Debes ser fundador de un clan para inscribirlo en este torneo
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-xl font-bold text-foreground font-tiktok uppercase mb-2">SOLO FUNDADORES</h2>
                                <p className="text-sm text-foreground/60 mb-6">
                                    Solo el fundador del clan puede inscribirlo en torneos. 
                                    Si deseas participar, crea tu propio equipo.
                                </p>
                            </>
                        )}
                        <div className="flex gap-3 justify-center">
                            <Link
                                href={`/esport/${tournamentId}`}
                                className="px-6 py-3 bg-black/10 text-foreground font-bold uppercase text-sm hover:bg-black/10 transition-all font-tiktok tracking-wider"
                            >
                                VOLVER
                            </Link>
                            <Link
                                href="/clanes/create"
                                className="px-6 py-3 bg-foreground text-white font-bold uppercase text-sm hover:brightness-110 transition-all font-tiktok tracking-wider"
                            >
                                CREAR MI EQUIPO
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Already registered
    if (isAlreadyRegistered) {
        return (
            <div className="relative min-h-screen">
                <div className="pt-8 sm:pt-12 max-w-lg mx-auto px-3 sm:px-4">
                    <div className="bg-card shadow-sm border border-foreground/30 rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-foreground font-tiktok uppercase mb-2">YA INSCRITO</h2>
                        <p className="text-sm text-foreground/60 mb-6">
                            Tu clan <span className="text-foreground font-bold">[{clan?.tag || 'N/A'}]</span> ya está inscrito en este torneo
                        </p>
                        <Link
                            href={`/esport/${tournamentId}`}
                            className="inline-block px-6 py-3 bg-foreground text-white font-bold uppercase text-sm hover:brightness-110 transition-all font-tiktok tracking-wider"
                        >
                            VER TORNEO
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // Registration closed
    if (tournament?.status !== 'REGISTRATION_OPEN') {
        return (
            <div className="relative min-h-screen">
                <div className="pt-8 sm:pt-12 max-w-lg mx-auto px-3 sm:px-4">
                    <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl p-8 text-center">
                        <h2 className="text-xl font-bold text-foreground font-tiktok uppercase mb-2">INSCRIPCIONES CERRADAS</h2>
                        <p className="text-sm text-foreground/60 mb-6">
                            Las inscripciones para este torneo no están abiertas
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

    // Main registration form
    return (
        <div className="relative min-h-screen">

            <div className="pt-8 sm:pt-12 max-w-xl mx-auto px-3 sm:px-4 pb-12 animate-fade-up">
                {/* Tournament Header */}
                <div className="bg-card shadow-sm border border-foreground/[0.06] rounded-xl animate-scale-fade [animation-delay:100ms]">
                    <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-6 py-4">
                        <h1 className="text-lg font-bold text-foreground font-tiktok uppercase tracking-wider">{tournament?.name || 'Torneo'}</h1>
                        <p className="text-sm text-foreground/40 mt-1">Inscripción de Clan</p>
                    </div>

                    {/* Clan Card */}
                    <div className="p-6 border-b border-foreground/[0.06]">
                        <p className="text-[10px] text-foreground/40 uppercase tracking-wider mb-3">TU CLAN</p>
                        <div className="flex items-center gap-4">
                            <Image
                                src={clan?.avatarUrl || DEFAULT_CLAN_AVATAR}
                                alt={clan?.name || 'Clan'}
                                width={56}
                                height={56}
                                className="rounded-lg border border-foreground/[0.06] object-cover"
                            />
                            <div>
                                <h2 className="text-lg font-bold text-foreground font-tiktok uppercase">{clan?.name || 'Sin nombre'}</h2>
                                <p className="text-foreground font-bold">[{clan?.tag || 'N/A'}]</p>
                                <p className="text-xs text-foreground/40 mt-1">
                                    {clan?.members?.length || 0} miembros
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="p-6 border-b border-foreground/[0.06] bg-foreground/5">
                        <p className="text-sm text-[#333]">
                            <span className="font-bold text-foreground">Nota:</span> Al inscribir tu clan, la organización del torneo revisará y aprobará tu inscripción. 
                            La selección de jugadores y roster se coordinará externamente según las bases del torneo.
                        </p>
                    </div>

                    {/* Accept Rules */}
                    <div className="p-6">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={acceptedRules}
                                onChange={(e) => setAcceptedRules(e.target.checked)}
                                className="mt-0.5 h-5 w-5 rounded border-black/20 bg-black/10 text-foreground focus:ring-foreground accent-[#1a1a1e]"
                            />
                            <div className="flex-1">
                                <p className="text-sm text-foreground">
                                    He leído y acepto las{' '}
                                    <Link href={`/esport/${tournamentId}`} target="_blank" className="text-foreground hover:underline">
                                        bases del torneo
                                    </Link>
                                </p>
                                <p className="text-xs text-foreground/40 mt-1">
                                    Al inscribirte, te comprometes a seguir las reglas establecidas
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-6">
                    <Link
                        href={`/esport/${tournamentId}`}
                        className="flex-1 px-6 py-4 bg-black/10 text-foreground font-bold uppercase text-center hover:bg-black/10 transition-all font-tiktok tracking-wider"
                    >
                        CANCELAR
                    </Link>
                    <button
                        onClick={handleSubmit}
                        disabled={!acceptedRules || registerMutation.isPending}
                        className="flex-1 px-6 py-4 bg-foreground text-white font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-tiktok tracking-wider"
                    >
                        {registerMutation.isPending ? 'INSCRIBIENDO...' : 'INSCRIBIR CLAN'}
                    </button>
                </div>
            </div>
        </div>
    )
}
