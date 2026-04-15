"use client"

interface MapResultCardProps {
    map: {
        id: string
        mapNumber: number
        mapName: string
        winnerId?: string | null
        score1?: number | null
        score2?: number | null
        status: string
        screenshotUrl?: string | null
        notes?: string | null
    }
    team1: { id: string; name: string; tag: string }
    team2: { id: string; name: string; tag: string }
    onDelete: () => void
}

export function MapResultCard({ map, team1, team2, onDelete }: MapResultCardProps) {
    const isTeam1Winner = map.winnerId === team1.id
    const isTeam2Winner = map.winnerId === team2.id

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'VALIDATED':
                return <span className="px-2 py-0.5 bg-green-500/20 text-green-600 border border-green-500/40 text-[10px] font-bold uppercase rounded-lg">Validado</span>
            case 'DISPUTED':
                return <span className="px-2 py-0.5 bg-red-500/20 text-red-500 border border-red-500/40 text-[10px] font-bold uppercase rounded-lg">Disputado</span>
            default:
                return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 border border-yellow-500/40 text-[10px] font-bold uppercase rounded-lg">Pendiente</span>
        }
    }

    return (
        <div className="bg-card/60 border border-foreground/[0.06] p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-foreground font-bold font-tiktok text-sm">
                        Mapa {map.mapNumber}
                    </span>
                    <span className="text-foreground/60 text-sm">
                        {map.mapName}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {getStatusBadge(map.status)}
                    <button
                        onClick={onDelete}
                        className="px-2 py-1 bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/30 text-[10px] font-bold uppercase rounded-lg transition-all"
                    >
                        Eliminar
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 items-center">
                <div className={`text-right ${isTeam1Winner ? 'text-green-600 font-bold' : 'text-foreground/60'}`}>
                    <div className="font-tiktok text-sm">[{team1.tag}] {team1.name}</div>
                </div>

                <div className="text-center">
                    <div className="font-bold text-xl text-foreground">
                        {map.score1 ?? '-'} : {map.score2 ?? '-'}
                    </div>
                </div>

                <div className={`text-left ${isTeam2Winner ? 'text-green-600 font-bold' : 'text-foreground/60'}`}>
                    <div className="font-tiktok text-sm">{team2.name} [{team2.tag}]</div>
                </div>
            </div>

            {map.notes && (
                <div className="mt-3 pt-3 border-t border-foreground/[0.06]">
                    <div className="text-[10px] text-foreground/40 uppercase font-bold mb-1">Notas:</div>
                    <div className="text-xs text-foreground/60">{map.notes}</div>
                </div>
            )}
        </div>
    )
}
