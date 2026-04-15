"use client"

import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"

interface GroupsTabProps {
    tournamentId: string
}

interface Registration {
    id: string
    clan?: {
        tag: string
        slug: string
        name: string
        avatarUrl?: string
    }
    player?: {
        username: string
    }
}

interface Group {
    id: string
    name: string
    registrations: Registration[]
}

export function GroupsTab({ tournamentId }: GroupsTabProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['tournament', tournamentId, 'groups'],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/groups`)
            if (!res.ok) throw new Error('Error al cargar grupos')
            return res.json()
        }
    })

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="text-foreground/40">Cargando grupos...</div>
            </div>
        )
    }

    if (error || !data?.groups || data.groups.length === 0) {
        return (
            <div className="p-12 text-center">
                <p className="text-foreground/40">Los grupos aún no han sido definidos</p>
                <p className="text-foreground/30 text-sm mt-1">
                    Los equipos serán asignados a grupos próximamente
                </p>
            </div>
        )
    }

    const groups: Group[] = data.groups

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groups.map((group) => (
                    <div
                        key={group.id}
                        className="bg-card border border-foreground/[0.06] rounded-xl"
                    >
                        {/* Group Header */}
                        <div className="px-4 py-3 bg-[var(--qc-bg-pure)] border-b border-foreground/[0.06] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-bold text-foreground font-tiktok uppercase tracking-wider">
                                    {group.name}
                                </h3>
                                <div className="h-1 w-8 bg-foreground rounded-full opacity-50" />
                            </div>
                            <span className="text-xs text-foreground/40">
                                {group.registrations.length} equipos
                            </span>
                        </div>

                        {/* Teams List */}
                        <div className="divide-y divide-white/5">
                            {group.registrations.length === 0 ? (
                                <div className="p-6 text-center">
                                    <p className="text-foreground/30 text-sm">Sin equipos asignados</p>
                                </div>
                            ) : (
                                group.registrations.map((reg, index) => (
                                    <Link
                                        key={reg.id}
                                        href={reg.clan ? `/clanes/${reg.clan.slug}` : '#'}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors group"
                                    >
                                        <span className={`w-6 text-center text-sm font-bold ${
                                            index === 0 ? 'text-[#FFD700]' :
                                            index === 1 ? 'text-[#C0C0C0]' :
                                            'text-foreground/40'
                                        }`}>
                                            {index + 1}
                                        </span>
                                        
                                        {reg.clan?.avatarUrl ? (
                                            <Image
                                                src={reg.clan.avatarUrl}
                                                alt={reg.clan.name || ''}
                                                width={32}
                                                height={32}
                                                className="rounded-lg"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-black/10 rounded-lg" />
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors">
                                                [{reg.clan?.tag || reg.player?.username}]
                                            </span>
                                            {reg.clan?.name && (
                                                <span className="text-xs text-foreground/40 ml-2">
                                                    {reg.clan.name}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Info */}
            <div className="mt-6 pt-6 border-t border-foreground/[0.06] text-center">
                <p className="text-xs text-foreground/40">
                    Los 2 mejores equipos de cada grupo clasifican a Playoffs
                </p>
            </div>
        </div>
    )
}
