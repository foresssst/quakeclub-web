"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { MapForm } from "./map-form"
import { MapResultCard } from "./map-result-card"
import Image from "next/image"

interface MatchCardProps {
    match: any
    tournamentId: string
    onUpdate: () => void
}

export function MatchCard({ match, tournamentId, onUpdate }: MatchCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    const team1 = {
        id: match.participant1Reg?.id || match.participant1Id,
        name: match.participant1Reg?.clan?.name || 'Team 1',
        tag: match.participant1Reg?.clan?.tag || 'T1',
        avatarUrl: match.participant1Reg?.clan?.avatarUrl
    }

    const team2 = {
        id: match.participant2Reg?.id || match.participant2Id,
        name: match.participant2Reg?.clan?.name || 'Team 2',
        tag: match.participant2Reg?.clan?.tag || 'T2',
        avatarUrl: match.participant2Reg?.clan?.avatarUrl
    }

    const maps = match.maps || []
    const isCompleted = match.status === 'COMPLETED'
    const bestOf = match.bestOf || 3

    const handleDeleteMap = async (mapId: string) => {
        if (!confirm('¿Eliminar este resultado?')) return

        try {
            const res = await fetch(`/api/admin/tournaments/${tournamentId}/matches/${match.id}/maps/${mapId}`, {
                method: 'DELETE'
            })

            if (!res.ok) throw new Error('Error al eliminar')

            alert('Resultado eliminado')
            onUpdate()
        } catch (error) {
            alert('Error al eliminar resultado')
        }
    }

    return (
        <div className="bg-card/40 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-foreground/[0.06]">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-black/5 transition-all"
            >
                <div className="flex items-center gap-6 flex-1">
                    {/* Team 1 */}
                    <div className="flex items-center gap-3 flex-1 justify-end">
                        <div className="text-right">
                            <div className="font-tiktok text-foreground font-bold">{team1.name}</div>
                            <div className="text-foreground text-sm">[{team1.tag}]</div>
                        </div>
                        {team1.avatarUrl && (
                            <Image
                                src={team1.avatarUrl}
                                alt={team1.name}
                                width={40}
                                height={40}
                                className="rounded-lg border border-foreground/[0.06]"
                            />
                        )}
                    </div>

                    {/* Score */}
                    <div className="text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-foreground">
                            {match.score1 ?? 0} : {match.score2 ?? 0}
                        </div>
                        <div className="text-[10px] text-foreground/40 uppercase">
                            BO{bestOf}
                        </div>
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center gap-3 flex-1">
                        {team2.avatarUrl && (
                            <Image
                                src={team2.avatarUrl}
                                alt={team2.name}
                                width={40}
                                height={40}
                                className="rounded-lg border border-foreground/[0.06]"
                            />
                        )}
                        <div className="text-left">
                            <div className="font-tiktok text-foreground font-bold">{team2.name}</div>
                            <div className="text-foreground text-sm">[{team2.tag}]</div>
                        </div>
                    </div>
                </div>

                {/* Status & Toggle */}
                <div className="flex items-center gap-4 ml-6">
                    {isCompleted ? (
                        <span className="px-3 py-1 bg-green-500/20 text-green-600 border border-green-500/40 text-xs font-bold uppercase rounded-lg">
                            Completado
                        </span>
                    ) : (
                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-600 border border-yellow-500/40 text-xs font-bold uppercase rounded-lg">
                            Pendiente
                        </span>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-foreground/60" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-foreground/60" />
                    )}
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-foreground/[0.06] p-6 space-y-4">
                    {/* Map Results */}
                    {maps.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-bold text-foreground/60 uppercase mb-3">
                                Resultados por Mapa
                            </h4>
                            {maps.map((map: any) => (
                                <MapResultCard
                                    key={map.id}
                                    map={map}
                                    team1={team1}
                                    team2={team2}
                                    onDelete={() => handleDeleteMap(map.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Register New Map */}
                    {!isCompleted && (
                        <>
                            <div className="border-t border-foreground/[0.06] my-4"></div>
                            <MapForm
                                matchId={match.id}
                                tournamentId={tournamentId}
                                team1={team1}
                                team2={team2}
                                mapNumber={maps.length + 1}
                                maxMaps={bestOf}
                                onSuccess={onUpdate}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
