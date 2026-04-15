"use client"

import { MatchCard } from "./match-card"

interface MatchListProps {
    matches: any[]
    tournamentId: string
    selectedGroup?: string | null
    onUpdate: () => void
}

export function MatchList({ matches, tournamentId, selectedGroup, onUpdate }: MatchListProps) {
    const filteredMatches = selectedGroup
        ? matches.filter(m => m.groupId === selectedGroup)
        : matches

    if (filteredMatches.length === 0) {
        return (
            <div className="bg-card/40 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-foreground/[0.06] p-12 text-center">
                <div className="text-foreground/40">
                    No hay partidos disponibles
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {filteredMatches.map((match) => (
                <MatchCard
                    key={match.id}
                    match={match}
                    tournamentId={tournamentId}
                    onUpdate={onUpdate}
                />
            ))}
        </div>
    )
}
