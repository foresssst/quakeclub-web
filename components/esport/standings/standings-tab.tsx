"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { FlagClan } from "@/components/flag-clan"

interface StandingsTabProps {
    tournamentId: string
}

interface TeamStandingAPI {
    registrationId: string
    clanId: string
    clanName: string
    clanTag: string
    clanSlug: string
    clanAvatarUrl?: string
    tournamentTeamId?: string
    tournamentTeamName?: string
    tournamentTeamTag?: string
    tournamentTeamAvatarUrl?: string
    participantType?: string
    groupId: string
    groupName: string
    played: number
    won: number
    drawn: number
    lost: number
    mapsWon: number
    mapsLost: number
    mapDiff: number
    points: number
}

interface TeamStanding {
    registrationId: string
    clan?: {
        tag: string
        slug: string
        name: string
        avatarUrl?: string
    }
    tournamentTeam?: {
        tag: string
        name: string
        avatarUrl?: string
    }
    player?: {
        username: string
    }
    played: number
    won: number
    drawn: number
    lost: number
    mapsWon: number
    mapsLost: number
    mapsDiff: number
    points: number
}

interface GroupStanding {
    groupId: string
    groupName: string
    standings: TeamStanding[]
}

export function StandingsTab({ tournamentId }: StandingsTabProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['tournament', tournamentId, 'standings'],
        queryFn: async () => {
            const res = await fetch(`/api/esport/tournaments/${tournamentId}/standings`)
            if (!res.ok) throw new Error('Error al cargar tabla')
            return res.json()
        }
    })

    if (isLoading) {
        return (
            <div className="p-8 text-center">
                <div className="text-foreground/40">Cargando tabla...</div>
            </div>
        )
    }

    // API returns { standings: { "Grupo A": [...], "Grupo B": [...] }, groups: [...] }
    // Transform object to array format
    const standingsObject = data?.standings
    const groupsInfo = data?.groups || []

    if (error || !standingsObject || Object.keys(standingsObject).length === 0) {
        return (
            <div className="p-12 text-center">
                <p className="text-foreground/40">No hay datos de clasificación disponibles</p>
            </div>
        )
    }

    // Transform the standings object into the array format the component expects
    const groupStandings: GroupStanding[] = Object.entries(standingsObject).map(([groupName, teams]) => {
        const groupInfo = groupsInfo.find((g: { id: string; name: string }) => g.name === groupName)
        return {
            groupId: groupInfo?.id || groupName,
            groupName: groupName,
            standings: (teams as TeamStandingAPI[]).map(team => ({
                registrationId: team.registrationId,
                clan: team.clanSlug ? {
                    tag: team.clanTag,
                    slug: team.clanSlug,
                    name: team.clanName,
                    avatarUrl: team.clanAvatarUrl
                } : undefined,
                tournamentTeam: team.tournamentTeamId ? {
                    tag: team.tournamentTeamTag || team.clanTag,
                    name: team.tournamentTeamName || team.clanName,
                    avatarUrl: team.tournamentTeamAvatarUrl || team.clanAvatarUrl
                } : undefined,
                played: team.played,
                won: team.won,
                drawn: team.drawn,
                lost: team.lost,
                mapsWon: team.mapsWon,
                mapsLost: team.mapsLost,
                mapsDiff: team.mapDiff,
                points: team.points
            }))
        }
    })

    return (
        <div className="p-6 space-y-8">
            {groupStandings.map((group) => (
                <div key={group.groupId}>
                    <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-sm font-bold text-foreground font-tiktok uppercase tracking-wider">
                            {group.groupName}
                        </h3>
                        <div className="h-1 w-8 bg-foreground rounded-full opacity-50" />
                    </div>
                    
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[10px] text-foreground/40 uppercase tracking-wider">
                                    <th className="text-left px-4 py-3 bg-card border-b border-foreground/[0.06]">#</th>
                                    <th className="text-left px-4 py-3 bg-card border-b border-foreground/[0.06]">EQUIPO</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">PJ</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">PG</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">PE</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">PP</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">MG</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">MP</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">DIF</th>
                                    <th className="text-center px-3 py-3 bg-card border-b border-foreground/[0.06]">PTS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.standings.map((team, index) => {
                                    const isQualified = index < 2
                                    return (
                                        <tr
                                            key={team.registrationId}
                                            className={`transition-colors ${
                                                isQualified 
                                                    ? 'bg-foreground/5 hover:bg-foreground/10' 
                                                    : 'bg-black/5 hover:bg-black/10'
                                            }`}
                                        >
                                            <td className="px-4 py-3">
                                                <span className={`text-sm font-bold ${
                                                    index === 0 ? 'text-[#FFD700]' :
                                                    index === 1 ? 'text-[#C0C0C0]' :
                                                    'text-foreground/40'
                                                }`}>
                                                    {index + 1}°
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {(() => {
                                                    const info = team.tournamentTeam || team.clan
                                                    const tag = info?.tag || team.player?.username || '??'
                                                    const name = info?.name || ''
                                                    const avatar = info?.avatarUrl
                                                    const link = team.clan?.slug ? `/clanes/${team.clan.slug}` : null

                                                    const content = (
                                                        <>
                                                            <FlagClan
                                                                clanTag={tag}
                                                                clanName={name || tag}
                                                                clanAvatar={avatar}
                                                                size="md"
                                                                showTooltip={false}
                                                            />
                                                            <span className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors">
                                                                [{tag}]
                                                            </span>
                                                            <span className="text-xs text-foreground/40 hidden lg:inline">
                                                                {name}
                                                            </span>
                                                        </>
                                                    )

                                                    return link ? (
                                                        <Link href={link} className="flex items-center gap-3 group">{content}</Link>
                                                    ) : (
                                                        <div className="flex items-center gap-3 group">{content}</div>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-3 py-3 text-center text-sm text-foreground/60">{team.played}</td>
                                            <td className="px-3 py-3 text-center text-sm text-foreground/60">{team.won}</td>
                                            <td className="px-3 py-3 text-center text-sm text-foreground/60">{team.drawn}</td>
                                            <td className="px-3 py-3 text-center text-sm text-foreground/60">{team.lost}</td>
                                            <td className="px-3 py-3 text-center text-sm text-foreground/60">{team.mapsWon}</td>
                                            <td className="px-3 py-3 text-center text-sm text-foreground/60">{team.mapsLost}</td>
                                            <td className="px-3 py-3 text-center text-sm">
                                                <span className={team.mapsDiff > 0 ? 'text-foreground' : team.mapsDiff < 0 ? 'text-foreground/40' : 'text-foreground/60'}>
                                                    {team.mapsDiff > 0 ? '+' : ''}{team.mapsDiff}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="text-lg font-bold text-foreground">{team.points}</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-1">
                        {group.standings.map((team, index) => {
                            const isQualified = index < 2
                            return (
                                <div
                                    key={team.registrationId}
                                    className={`p-3 ${
                                        isQualified 
                                            ? 'bg-foreground/5 border-l-2 border-foreground' 
                                            : 'bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold w-6 ${
                                                index === 0 ? 'text-[#FFD700]' :
                                                index === 1 ? 'text-[#C0C0C0]' :
                                                'text-foreground/40'
                                            }`}>
                                                {index + 1}°
                                            </span>
                                            {(() => {
                                                const info = team.tournamentTeam || team.clan
                                                const tag = info?.tag || team.player?.username || '??'
                                                const avatar = info?.avatarUrl
                                                const name = info?.name || ''
                                                const link = team.clan?.slug ? `/clanes/${team.clan.slug}` : null

                                                const content = (
                                                    <>
                                                        <FlagClan
                                                            clanTag={tag}
                                                            clanName={name || tag}
                                                            clanAvatar={avatar}
                                                            size="sm"
                                                            showTooltip={false}
                                                        />
                                                        <span className="text-sm font-bold text-foreground">[{tag}]</span>
                                                    </>
                                                )

                                                return link ? (
                                                    <Link href={link} className="flex items-center gap-2 hover:opacity-80 transition-opacity">{content}</Link>
                                                ) : (
                                                    <div className="flex items-center gap-2">{content}</div>
                                                )
                                            })()}
                                        </div>
                                        <span className="text-xl font-bold text-foreground">{team.points}</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                        <div>
                                            <div className="text-foreground/30 uppercase">PJ</div>
                                            <div className="text-foreground/60">{team.played}</div>
                                        </div>
                                        <div>
                                            <div className="text-foreground/30 uppercase">PG</div>
                                            <div className="text-foreground/60">{team.won}</div>
                                        </div>
                                        <div>
                                            <div className="text-foreground/30 uppercase">PP</div>
                                            <div className="text-foreground/60">{team.lost}</div>
                                        </div>
                                        <div>
                                            <div className="text-foreground/30 uppercase">DIF</div>
                                            <div className={`${team.mapsDiff > 0 ? 'text-foreground' : 'text-foreground/40'}`}>
                                                {team.mapsDiff > 0 ? '+' : ''}{team.mapsDiff}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            {/* Legend */}
            <div className="pt-6 border-t border-foreground/[0.06]">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-foreground/40 uppercase tracking-wider">
                    <span>PJ: Partidos Jugados</span>
                    <span>PG: Ganados</span>
                    <span>PE: Empates</span>
                    <span>PP: Perdidos</span>
                    <span>MG: Mapas Ganados</span>
                    <span>MP: Mapas Perdidos</span>
                    <span>DIF: Diferencia</span>
                    <span>PTS: Puntos (1 por mapa)</span>
                </div>
            </div>
        </div>
    )
}
