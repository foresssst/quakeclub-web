"use client"

import Image from "next/image"
import Link from "next/link"

interface GroupDisplayProps {
    group: {
        id: string
        name: string
        order: number
        registrations?: any[]
    }
}

export function GroupDisplay({ group }: GroupDisplayProps) {
    const teams = group.registrations || []

    return (
        <div className="bg-card border border-foreground/[0.06] rounded-xl">
            {/* Group Header */}
            <div className="bg-[var(--qc-bg-medium)] px-4 py-3 border-b border-foreground/[0.06]">
                <h3 className="text-lg font-bold text-foreground font-tiktok uppercase tracking-wider">
                    {group.name}
                </h3>
                <div className="text-xs text-foreground/40 mt-1">
                    {teams.length} equipos
                </div>
            </div>

            {/* Teams List */}
            <div className="divide-y divide-white/5">
                {teams.length === 0 ? (
                    <div className="p-6 text-center text-foreground/40 text-sm">
                        Sin equipos asignados
                    </div>
                ) : (
                    teams.map((registration: any, index: number) => {
                        const teamInfo = registration.tournamentTeam || registration.clan
                        const teamLink = registration.clan?.slug ? `/clanes/${registration.clan.slug}` : null
                        const avatarUrl = teamInfo?.avatarUrl
                        const name = teamInfo?.name || registration.player?.username || 'TBD'
                        const tag = teamInfo?.tag

                        const content = (
                            <>
                                <div className="text-foreground/40 font-bold text-sm min-w-[24px]">
                                    {index + 1}
                                </div>
                                {avatarUrl && (
                                    <Image
                                        src={avatarUrl}
                                        alt={name}
                                        width={32}
                                        height={32}
                                        className="rounded-lg border border-foreground/[0.06]"
                                    />
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-foreground font-bold font-tiktok text-sm">
                                            {name}
                                        </span>
                                        {tag && (
                                            <span className="text-foreground text-xs">
                                                [{tag}]
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-foreground/40">
                                        {registration.roster?.length || 0} jugadores
                                    </div>
                                </div>
                            </>
                        )

                        return teamLink ? (
                            <Link
                                key={registration.id}
                                href={teamLink}
                                className="p-3 hover:bg-foreground/[0.04] transition-colors flex items-center gap-3"
                            >
                                {content}
                            </Link>
                        ) : (
                            <div
                                key={registration.id}
                                className="p-3 hover:bg-foreground/[0.04] transition-colors flex items-center gap-3"
                            >
                                {content}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
