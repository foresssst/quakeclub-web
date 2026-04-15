"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { X, Search, Users, Plus } from "lucide-react"
import Image from "next/image"

interface AdminRegistrationModalProps {
    tournamentId: string
    isOpen: boolean
    onClose: () => void
}

export function AdminRegistrationModal({ tournamentId, isOpen, onClose }: AdminRegistrationModalProps) {
    const [search, setSearch] = useState("")
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['available-clans', tournamentId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/tournaments/${tournamentId}/available-clans`)
            if (!res.ok) throw new Error('Error al cargar clanes')
            return res.json()
        },
        enabled: isOpen
    })

    const registerMutation = useMutation({
        mutationFn: async (tag: string) => {
            const res = await fetch(`/api/admin/tournaments/${tournamentId}/registrations/create-by-tag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag })
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Error al inscribir clan')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] })
            queryClient.invalidateQueries({ queryKey: ['available-clans', tournamentId] })
            alert('Clan inscrito exitosamente')
            onClose()
        },
        onError: (error: Error) => {
            alert(error.message)
        }
    })

    if (!isOpen) return null

    const filteredClans = data?.clans?.filter((clan: any) =>
        (clan.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (clan.tag?.toLowerCase() || '').includes(search.toLowerCase())
    ) || []

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--qc-bg-pure)]/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-card border border-foreground/[0.06] shadow-2xl rounded-xl flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)]">
                    <h2 className="text-xl font-bold text-foreground font-tiktok uppercase">Inscribir Clan Manualmente</h2>
                    <button onClick={onClose} className="text-foreground/60 hover:text-foreground transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-6 border-b border-foreground/[0.06]">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground/40" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o tag..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-foreground/[0.04] border border-foreground/[0.06] py-3 pl-12 pr-4 text-foreground placeholder-black/40 focus:border-foreground focus:outline-none transition-colors"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="text-center text-foreground/40 py-8">Cargando clanes...</div>
                    ) : filteredClans.length === 0 ? (
                        <div className="text-center text-foreground/40 py-8">No se encontraron clanes disponibles</div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredClans.map((clan: any) => (
                                <div
                                    key={clan.id}
                                    className="flex items-center justify-between p-4 bg-black/5 border border-foreground/[0.06] hover:border-black/20 transition-all group rounded-lg"
                                >
                                    <div className="flex items-center gap-4">
                                        {clan.avatarUrl ? (
                                            <Image
                                                src={clan.avatarUrl}
                                                alt={clan.name}
                                                width={48}
                                                height={48}
                                                className="rounded-lg"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-black/10 flex items-center justify-center rounded-lg">
                                                <Users className="h-6 w-6 text-foreground/20" />
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-foreground font-bold font-tiktok text-lg">{clan.name}</span>
                                                <span className="text-foreground font-bold">[{clan.tag}]</span>
                                            </div>
                                            <div className="text-sm text-foreground/40">
                                                {clan._count.ClanMember} miembros
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => registerMutation.mutate(clan.tag)}
                                        disabled={registerMutation.isPending}
                                        className="px-4 py-2 bg-foreground text-white font-bold uppercase text-sm hover:brightness-110 transition-all font-tiktok rounded-lg flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {registerMutation.isPending ? 'Inscribiendo...' : (
                                            <>
                                                <Plus className="h-4 w-4" />
                                                Inscribir
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
